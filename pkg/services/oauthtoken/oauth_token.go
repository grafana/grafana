package oauthtoken

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("oauthtoken")
	// ExpiryDelta is used to prevent any issue that is caused by the clock skew (server times can differ slightly between different machines).
	// Shouldn't be more than 30s
	ExpiryDelta            = 10 * time.Second
	ErrNoRefreshTokenFound = errors.New("no refresh token found")
	ErrNotAnOAuthProvider  = errors.New("not an oauth provider")
	ErrCouldntRefreshToken = errors.New("could not refresh token")
)

type Service struct {
	Cfg             *setting.Cfg
	SocialService   social.Service
	AuthInfoService login.AuthInfoService
	serverLock      *serverlock.ServerLockService

	tokenRefreshDuration *prometheus.HistogramVec
}

//go:generate mockery --name OAuthTokenService --structname MockService --outpkg oauthtokentest --filename service_mock.go --output ./oauthtokentest/
type OAuthTokenService interface {
	GetCurrentOAuthToken(context.Context, identity.Requester) *oauth2.Token
	IsOAuthPassThruEnabled(*datasources.DataSource) bool
	HasOAuthEntry(context.Context, identity.Requester) (*login.UserAuth, bool, error)
	TryTokenRefresh(context.Context, identity.Requester) (*oauth2.Token, error)
	InvalidateOAuthTokens(context.Context, *login.UserAuth) error
}

func ProvideService(socialService social.Service, authInfoService login.AuthInfoService, cfg *setting.Cfg, registerer prometheus.Registerer, serverLockService *serverlock.ServerLockService) *Service {
	return &Service{
		AuthInfoService:      authInfoService,
		Cfg:                  cfg,
		SocialService:        socialService,
		serverLock:           serverLockService,
		tokenRefreshDuration: newTokenRefreshDurationMetric(registerer),
	}
}

// GetCurrentOAuthToken returns the OAuth token, if any, for the authenticated user. Will try to refresh the token if it has expired.
func (o *Service) GetCurrentOAuthToken(ctx context.Context, usr identity.Requester) *oauth2.Token {
	authInfo, ok, _ := o.HasOAuthEntry(ctx, usr)
	if !ok {
		return nil
	}

	if err := checkOAuthRefreshToken(authInfo); err != nil {
		if errors.Is(err, ErrNoRefreshTokenFound) {
			return buildOAuthTokenFromAuthInfo(authInfo)
		}

		return nil
	}

	persistedToken, refreshNeeded := needTokenRefresh(authInfo)
	if !refreshNeeded {
		return persistedToken
	}

	token, err := o.TryTokenRefresh(ctx, usr)
	if err != nil {
		if errors.Is(err, ErrNoRefreshTokenFound) {
			return buildOAuthTokenFromAuthInfo(authInfo)
		}

		return nil
	}

	return token
}

// IsOAuthPassThruEnabled returns true if Forward OAuth Identity (oauthPassThru) is enabled for the provided data source.
func (o *Service) IsOAuthPassThruEnabled(ds *datasources.DataSource) bool {
	return IsOAuthPassThruEnabled(ds)
}

// HasOAuthEntry returns true and the UserAuth object when OAuth info exists for the specified User
func (o *Service) HasOAuthEntry(ctx context.Context, usr identity.Requester) (*login.UserAuth, bool, error) {
	if usr == nil || usr.IsNil() {
		// No user, therefore no token
		return nil, false, nil
	}

	namespace, id := usr.GetNamespacedID()
	if namespace != identity.NamespaceUser {
		// Not a user, therefore no token.
		return nil, false, nil
	}

	ctxLogger := logger.FromContext(ctx)

	userID, err := identity.IntIdentifier(namespace, id)
	if err != nil {
		ctxLogger.Error("Failed to convert user id to int", "namespace", namespace, "userID", id, "error", err)
		return nil, false, err
	}

	ctxLogger = ctxLogger.New("userID", userID)

	authInfoQuery := &login.GetAuthInfoQuery{UserId: userID}
	authInfo, err := o.AuthInfoService.GetAuthInfo(ctx, authInfoQuery)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			// Not necessarily an error.  User may be logged in another way.
			ctxLogger.Debug("No oauth token found for user", "username", usr.GetLogin())
			return nil, false, nil
		}
		ctxLogger.Error("Failed to fetch oauth token for user", "username", usr.GetLogin(), "error", err)
		return nil, false, err
	}
	if !strings.Contains(authInfo.AuthModule, "oauth") {
		return nil, false, nil
	}
	return authInfo, true, nil
}

// TryTokenRefresh returns an error in case the OAuth token refresh was unsuccessful
// It uses a server lock to prevent getting the Refresh Token multiple times for a given User
func (o *Service) TryTokenRefresh(ctx context.Context, usr identity.Requester) (*oauth2.Token, error) {
	if usr == nil || usr.IsNil() {
		logger.Warn("Can only refresh OAuth tokens for existing users", "user", "nil")
		// Not user, no token.
		return nil, nil
	}

	namespace, id := usr.GetNamespacedID()
	if namespace != identity.NamespaceUser {
		// Not a user, therefore no token.
		logger.Warn("Can only refresh OAuth tokens for users", "namespace", namespace, "userId", id)
		return nil, nil
	}

	ctxLogger := logger.FromContext(ctx)

	userID, err := identity.IntIdentifier(namespace, id)
	if err != nil {
		ctxLogger.Warn("Failed to convert user id to int", "namespace", namespace, "userId", id, "error", err)
		return nil, nil
	}

	ctxLogger = ctxLogger.New("userID", userID)

	lockKey := fmt.Sprintf("oauth-refresh-token-%d", userID)

	lockTimeConfig := serverlock.LockTimeConfig{
		MaxInterval: 30 * time.Second,
		MinWait:     50 * time.Millisecond,
		MaxWait:     250 * time.Millisecond,
	}

	retryOpt := func(attempts int) error {
		if attempts < 5 {
			return nil
		}
		return ErrCouldntRefreshToken
	}

	var newToken *oauth2.Token
	var cmdErr error

	lockErr := o.serverLock.LockExecuteAndReleaseWithRetries(ctx, lockKey, lockTimeConfig, func(ctx context.Context) {
		ctxLogger.Debug("serverlock request for getting a new access token", "key", lockKey)

		authInfo, exists, err := o.HasOAuthEntry(ctx, usr)
		if !exists {
			if err != nil {
				ctxLogger.Debug("Failed to fetch oauth entry", "error", err)
			}
			return
		}

		_, needRefresh := needTokenRefresh(authInfo)
		if !needRefresh {
			return
		}

		// get the token's auth provider (f.e. azuread)
		provider := strings.TrimPrefix(authInfo.AuthModule, "oauth_")
		currentOAuthInfo := o.SocialService.GetOAuthInfoProvider(provider)
		if currentOAuthInfo == nil {
			ctxLogger.Warn("OAuth provider not found", "provider", provider)
			return
		}

		// if refresh token handling is disabled for this provider, we can skip the refresh
		if !currentOAuthInfo.UseRefreshToken {
			ctxLogger.Debug("Skipping token refresh", "provider", provider)
			return
		}

		newToken, cmdErr = o.tryGetOrRefreshOAuthToken(ctx, authInfo)
	}, retryOpt)
	if lockErr != nil {
		ctxLogger.Error("Failed to obtain token refresh lock", "error", err)
		return nil, lockErr
	}

	// Silence ErrNoRefreshTokenFound
	if errors.Is(cmdErr, ErrNoRefreshTokenFound) {
		return nil, nil
	}

	return newToken, cmdErr
}

func buildOAuthTokenFromAuthInfo(authInfo *login.UserAuth) *oauth2.Token {
	token := &oauth2.Token{
		AccessToken:  authInfo.OAuthAccessToken,
		Expiry:       authInfo.OAuthExpiry,
		RefreshToken: authInfo.OAuthRefreshToken,
		TokenType:    authInfo.OAuthTokenType,
	}

	if authInfo.OAuthIdToken != "" {
		token = token.WithExtra(map[string]any{"id_token": authInfo.OAuthIdToken})
	}

	return token
}

func checkOAuthRefreshToken(authInfo *login.UserAuth) error {
	if !strings.Contains(authInfo.AuthModule, "oauth") {
		logger.Warn("The specified user's auth provider is not oauth",
			"authmodule", authInfo.AuthModule, "userid", authInfo.UserId)
		return ErrNotAnOAuthProvider
	}

	if authInfo.OAuthRefreshToken == "" {
		logger.Warn("No refresh token available",
			"authmodule", authInfo.AuthModule, "userid", authInfo.UserId)
		return ErrNoRefreshTokenFound
	}

	return nil
}

// InvalidateOAuthTokens invalidates the OAuth tokens (access_token, refresh_token) and sets the Expiry to default/zero
func (o *Service) InvalidateOAuthTokens(ctx context.Context, authInfo *login.UserAuth) error {
	return o.AuthInfoService.UpdateAuthInfo(ctx, &login.UpdateAuthInfoCommand{
		UserId:     authInfo.UserId,
		AuthModule: authInfo.AuthModule,
		AuthId:     authInfo.AuthId,
		OAuthToken: &oauth2.Token{
			AccessToken:  "",
			RefreshToken: "",
			Expiry:       time.Time{},
		},
	})
}

func (o *Service) tryGetOrRefreshOAuthToken(ctx context.Context, authInfo *login.UserAuth) (*oauth2.Token, error) {
	ctxLogger := logger.FromContext(ctx).New("userID", authInfo.UserId)

	if err := checkOAuthRefreshToken(authInfo); err != nil {
		return nil, err
	}

	persistedToken, refreshNeeded := needTokenRefresh(authInfo)
	if !refreshNeeded {
		return persistedToken, nil
	}

	authProvider := authInfo.AuthModule
	connect, err := o.SocialService.GetConnector(authProvider)
	if err != nil {
		ctxLogger.Error("Failed to get oauth connector", "provider", authProvider, "error", err)
		return persistedToken, err
	}

	client, err := o.SocialService.GetOAuthHttpClient(authProvider)
	if err != nil {
		ctxLogger.Error("Failed to get oauth http client", "provider", authProvider, "error", err)
		return persistedToken, err
	}
	ctx = context.WithValue(ctx, oauth2.HTTPClient, client)

	start := time.Now()
	// TokenSource handles refreshing the token if it has expired
	token, err := connect.TokenSource(ctx, persistedToken).Token()
	duration := time.Since(start)
	o.tokenRefreshDuration.WithLabelValues(authProvider, fmt.Sprintf("%t", err == nil)).Observe(duration.Seconds())

	if err != nil {
		ctxLogger.Error("Failed to retrieve oauth access token",
			"provider", authInfo.AuthModule, "userId", authInfo.UserId, "error", err)

		// token refresh failed, invalidate the old token
		if err := o.InvalidateOAuthTokens(ctx, authInfo); err != nil {
			ctxLogger.Warn("Failed to invalidate OAuth tokens", "id", authInfo.Id, "error", err)
		}

		return nil, err
	}

	// If the tokens are not the same, update the entry in the DB
	if !tokensEq(persistedToken, token) {
		updateAuthCommand := &login.UpdateAuthInfoCommand{
			UserId:     authInfo.UserId,
			AuthModule: authInfo.AuthModule,
			AuthId:     authInfo.AuthId,
			OAuthToken: token,
		}

		if o.Cfg.Env == setting.Dev {
			ctxLogger.Debug("Oauth got token",
				"auth_module", authInfo.AuthModule,
				"expiry", fmt.Sprintf("%v", token.Expiry),
				"access_token", fmt.Sprintf("%v", token.AccessToken),
				"refresh_token", fmt.Sprintf("%v", token.RefreshToken),
			)
		}

		if err := o.AuthInfoService.UpdateAuthInfo(ctx, updateAuthCommand); err != nil {
			ctxLogger.Error("Failed to update auth info during token refresh", "userId", authInfo.UserId, "error", err)
			return token, err
		}
		ctxLogger.Debug("Updated oauth info for user")
	}

	return token, nil
}

// IsOAuthPassThruEnabled returns true if Forward OAuth Identity (oauthPassThru) is enabled for the provided data source.
func IsOAuthPassThruEnabled(ds *datasources.DataSource) bool {
	return ds.JsonData != nil && ds.JsonData.Get("oauthPassThru").MustBool()
}

func newTokenRefreshDurationMetric(registerer prometheus.Registerer) *prometheus.HistogramVec {
	tokenRefreshDuration := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Subsystem: "oauth",
		Name:      "token_refresh_fetch_duration_seconds",
		Help:      "Time taken to fetch access token using refresh token",
	},
		[]string{"auth_provider", "success"})
	if registerer != nil {
		registerer.MustRegister(tokenRefreshDuration)
	}
	return tokenRefreshDuration
}

// tokensEq checks for OAuth2 token equivalence given the fields of the struct Grafana is interested in
func tokensEq(t1, t2 *oauth2.Token) bool {
	t1IdToken, ok1 := t1.Extra("id_token").(string)
	t2IdToken, ok2 := t2.Extra("id_token").(string)

	return t1.AccessToken == t2.AccessToken &&
		t1.RefreshToken == t2.RefreshToken &&
		t1.Expiry.Equal(t2.Expiry) &&
		t1.TokenType == t2.TokenType &&
		ok1 == ok2 &&
		t1IdToken == t2IdToken
}

func needTokenRefresh(authInfo *login.UserAuth) (*oauth2.Token, bool) {
	var hasAccessTokenExpired, hasIdTokenExpired bool

	persistedToken := buildOAuthTokenFromAuthInfo(authInfo)

	idTokenExp, err := getIDTokenExpiry(authInfo.OAuthIdToken)
	if err != nil {
		logger.Warn("Could not get ID Token expiry", "error", err)
	}
	if !persistedToken.Expiry.IsZero() {
		_, hasAccessTokenExpired = getExpiryWithSkew(persistedToken.Expiry)
	}
	if !idTokenExp.IsZero() {
		_, hasIdTokenExpired = getExpiryWithSkew(idTokenExp)
	}
	if !hasAccessTokenExpired && !hasIdTokenExpired {
		logger.Debug("Neither access nor id token have expired yet", "userID", authInfo.UserId)
		return persistedToken, false
	}
	if hasIdTokenExpired {
		// Force refreshing token when id token is expired
		persistedToken.AccessToken = ""
	}
	return persistedToken, true
}

// getIDTokenExpiry extracts the expiry time from the ID token
func getIDTokenExpiry(idToken string) (time.Time, error) {
	if idToken == "" {
		return time.Time{}, nil
	}

	parsedToken, err := jwt.ParseSigned(idToken)
	if err != nil {
		return time.Time{}, fmt.Errorf("error parsing id token: %w", err)
	}

	type Claims struct {
		Exp int64 `json:"exp"`
	}
	var claims Claims
	if err := parsedToken.UnsafeClaimsWithoutVerification(&claims); err != nil {
		return time.Time{}, fmt.Errorf("error getting claims from id token: %w", err)
	}

	return time.Unix(claims.Exp, 0), nil
}

func getExpiryWithSkew(expiry time.Time) (adjustedExpiry time.Time, hasTokenExpired bool) {
	adjustedExpiry = expiry.Round(0).Add(-ExpiryDelta)
	hasTokenExpired = adjustedExpiry.Before(time.Now())
	return
}

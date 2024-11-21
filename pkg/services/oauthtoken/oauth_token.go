package oauthtoken

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/oauth2"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
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
	tracer          tracing.Tracer

	tokenRefreshDuration *prometheus.HistogramVec
}

//go:generate mockery --name OAuthTokenService --structname MockService --outpkg oauthtokentest --filename service_mock.go --output ./oauthtokentest/
type OAuthTokenService interface {
	GetCurrentOAuthToken(context.Context, identity.Requester) *oauth2.Token
	IsOAuthPassThruEnabled(*datasources.DataSource) bool
	HasOAuthEntry(context.Context, identity.Requester) (*login.UserAuth, bool, error)
	TryTokenRefresh(context.Context, identity.Requester) (*oauth2.Token, error)
	InvalidateOAuthTokens(context.Context, identity.Requester) error
}

func ProvideService(socialService social.Service, authInfoService login.AuthInfoService, cfg *setting.Cfg, registerer prometheus.Registerer,
	serverLockService *serverlock.ServerLockService, tracer tracing.Tracer,
) *Service {
	return &Service{
		AuthInfoService:      authInfoService,
		Cfg:                  cfg,
		SocialService:        socialService,
		serverLock:           serverLockService,
		tokenRefreshDuration: newTokenRefreshDurationMetric(registerer),
		tracer:               tracer,
	}
}

// GetCurrentOAuthToken returns the OAuth token, if any, for the authenticated user. Will try to refresh the token if it has expired.
func (o *Service) GetCurrentOAuthToken(ctx context.Context, usr identity.Requester) *oauth2.Token {
	ctx, span := o.tracer.Start(ctx, "oauthtoken.GetCurrentOAuthToken")
	defer span.End()

	ctxLogger := logger.FromContext(ctx)

	if usr == nil || usr.IsNil() {
		ctxLogger.Warn("Can only get OAuth tokens for existing users", "user", "nil")
		// Not user, no token.
		return nil
	}

	if !usr.IsIdentityType(claims.TypeUser) {
		ctxLogger.Warn("Can only get OAuth tokens for users", "id", usr.GetID())
		return nil
	}

	userID, err := usr.GetInternalID()
	if err != nil {
		logger.Error("Failed to convert user id to int", "id", usr.GetID(), "error", err)
		return nil
	}

	ctxLogger = ctxLogger.New("userID", userID)

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

	persistedToken := buildOAuthTokenFromAuthInfo(authInfo)

	refreshNeeded := needTokenRefresh(ctx, persistedToken)
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
	ctx, span := o.tracer.Start(ctx, "oauthtoken.HasOAuthEntry")
	defer span.End()

	if usr == nil || usr.IsNil() {
		// No user, therefore no token
		return nil, false, nil
	}

	if !usr.IsIdentityType(claims.TypeUser) {
		return nil, false, nil
	}

	ctxLogger := logger.FromContext(ctx)
	userID, err := usr.GetInternalID()
	if err != nil {
		ctxLogger.Error("Failed to convert user id to int", "id", usr.GetID(), "error", err)
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
	ctx, span := o.tracer.Start(ctx, "oauthtoken.TryTokenRefresh")
	defer span.End()

	ctxLogger := logger.FromContext(ctx)

	if usr == nil || usr.IsNil() {
		ctxLogger.Warn("Can only refresh OAuth tokens for existing users", "user", "nil")
		// Not user, no token.
		return nil, nil
	}

	if !usr.IsIdentityType(claims.TypeUser) {
		ctxLogger.Warn("Can only refresh OAuth tokens for users", "id", usr.GetID())
		return nil, nil
	}

	userID, err := usr.GetInternalID()
	if err != nil {
		ctxLogger.Warn("Failed to convert user id to int", "id", usr.GetID(), "error", err)
		return nil, nil
	}

	ctxLogger = ctxLogger.New("userID", userID)

	// get the token's auth provider (f.e. azuread)
	currAuthenticator := usr.GetAuthenticatedBy()
	if !strings.HasPrefix(currAuthenticator, "oauth") {
		ctxLogger.Warn("The specified user's auth provider is not OAuth", "authmodule", currAuthenticator)
		return nil, nil
	}

	provider := strings.TrimPrefix(currAuthenticator, "oauth_")
	currentOAuthInfo := o.SocialService.GetOAuthInfoProvider(provider)
	if currentOAuthInfo == nil {
		ctxLogger.Warn("OAuth provider not found", "provider", provider)
		return nil, nil
	}

	// if refresh token handling is disabled for this provider, we can skip the refresh
	if !currentOAuthInfo.UseRefreshToken {
		ctxLogger.Debug("Skipping token refresh", "provider", provider)
		return nil, nil
	}

	lockKey := fmt.Sprintf("oauth-refresh-token-%d", userID)

	lockTimeConfig := serverlock.LockTimeConfig{
		MaxInterval: 30 * time.Second,
		MinWait:     time.Duration(o.Cfg.OAuthRefreshTokenServerLockMinWaitMs) * time.Millisecond,
		MaxWait:     time.Duration(o.Cfg.OAuthRefreshTokenServerLockMinWaitMs+500) * time.Millisecond,
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
		ctx, span := o.tracer.Start(ctx, "oauthtoken server lock",
			trace.WithAttributes(attribute.Int64("userID", userID)))
		defer span.End()

		ctxLogger.Debug("Serverlock request for getting a new access token", "key", lockKey)

		authInfo, exists, err := o.HasOAuthEntry(ctx, usr)
		if !exists {
			if err != nil {
				ctxLogger.Debug("Failed to fetch oauth entry", "error", err)
			}
			return
		}

		persistedToken := buildOAuthTokenFromAuthInfo(authInfo)

		needRefresh := needTokenRefresh(ctx, persistedToken)
		if !needRefresh {
			// Set the token which is returned by the outer function in case there's no need to refresh the token
			newToken = persistedToken
			return
		}

		newToken, cmdErr = o.tryGetOrRefreshOAuthToken(ctx, persistedToken, usr)
	}, retryOpt)
	if lockErr != nil {
		ctxLogger.Error("Failed to obtain token refresh lock", "error", lockErr)
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
func (o *Service) InvalidateOAuthTokens(ctx context.Context, usr identity.Requester) error {
	userID, err := usr.GetInternalID()
	if err != nil {
		logger.Error("Failed to convert user id to int", "id", usr.GetID(), "error", err)
		return err
	}

	return o.AuthInfoService.UpdateAuthInfo(ctx, &login.UpdateAuthInfoCommand{
		UserId:     userID,
		AuthModule: usr.GetAuthenticatedBy(),
		AuthId:     usr.GetAuthID(),
		OAuthToken: &oauth2.Token{
			AccessToken:  "",
			RefreshToken: "",
			Expiry:       time.Time{},
		},
	})
}

func (o *Service) tryGetOrRefreshOAuthToken(ctx context.Context, persistedToken *oauth2.Token, usr identity.Requester) (*oauth2.Token, error) {
	ctx, span := o.tracer.Start(ctx, "oauthtoken.tryGetOrRefreshOAuthToken")
	defer span.End()

	userID, err := usr.GetInternalID()
	if err != nil {
		logger.Error("Failed to convert user id to int", "id", usr.GetID(), "error", err)
		return nil, err
	}

	span.SetAttributes(attribute.Int64("userID", userID))

	ctxLogger := logger.FromContext(ctx).New("userID", userID)

	if persistedToken.RefreshToken == "" {
		ctxLogger.Warn("No refresh token available", "authmodule", usr.GetAuthenticatedBy())
		return nil, ErrNoRefreshTokenFound
	}

	refreshNeeded := needTokenRefresh(ctx, persistedToken)
	if !refreshNeeded {
		return persistedToken, nil
	}

	authProvider := usr.GetAuthenticatedBy()
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
			"provider", usr.GetAuthenticatedBy(), "error", err)

		// token refresh failed, invalidate the old token
		if err := o.InvalidateOAuthTokens(ctx, usr); err != nil {
			ctxLogger.Warn("Failed to invalidate OAuth tokens", "authID", usr.GetAuthID(), "error", err)
		}

		return nil, err
	}

	// If the tokens are not the same, update the entry in the DB
	if !tokensEq(persistedToken, token) {
		updateAuthCommand := &login.UpdateAuthInfoCommand{
			UserId:     userID,
			AuthModule: usr.GetAuthenticatedBy(),
			AuthId:     usr.GetAuthID(),
			OAuthToken: token,
		}

		if o.Cfg.Env == setting.Dev {
			ctxLogger.Debug("Oauth got token",
				"auth_module", usr.GetAuthID(),
				"expiry", fmt.Sprintf("%v", token.Expiry),
				"access_token", fmt.Sprintf("%v", token.AccessToken),
				"refresh_token", fmt.Sprintf("%v", token.RefreshToken),
			)
		}

		if err := o.AuthInfoService.UpdateAuthInfo(ctx, updateAuthCommand); err != nil {
			ctxLogger.Error("Failed to update auth info during token refresh", "authID", usr.GetAuthID(), "error", err)
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

func needTokenRefresh(ctx context.Context, persistedToken *oauth2.Token) bool {
	var hasAccessTokenExpired, hasIdTokenExpired bool

	ctxLogger := logger.FromContext(ctx)

	idTokenExp, err := GetIDTokenExpiry(persistedToken)
	if err != nil {
		ctxLogger.Warn("Could not get ID Token expiry", "error", err)
	}
	if !persistedToken.Expiry.IsZero() {
		_, hasAccessTokenExpired = getExpiryWithSkew(persistedToken.Expiry)
	}
	if !idTokenExp.IsZero() {
		_, hasIdTokenExpired = getExpiryWithSkew(idTokenExp)
	}
	if !hasAccessTokenExpired && !hasIdTokenExpired {
		ctxLogger.Debug("Neither access nor id token have expired yet")
		return false
	}
	if hasIdTokenExpired {
		// Force refreshing token when id token is expired
		persistedToken.AccessToken = ""
	}
	return true
}

// GetIDTokenExpiry extracts the expiry time from the ID token
func GetIDTokenExpiry(token *oauth2.Token) (time.Time, error) {
	idToken, ok := token.Extra("id_token").(string)
	if !ok {
		return time.Time{}, nil
	}

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

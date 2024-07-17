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
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
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
)

const maxOAuthTokenCacheTTL = 10 * time.Minute

type Service struct {
	Cfg               *setting.Cfg
	SocialService     social.Service
	AuthInfoService   login.AuthInfoService
	singleFlightGroup *singleflight.Group
	cache             *localcache.CacheService

	tokenRefreshDuration *prometheus.HistogramVec
}

//go:generate mockery --name OAuthTokenService --structname MockService --outpkg oauthtokentest --filename service_mock.go --output ./oauthtokentest/
type OAuthTokenService interface {
	GetCurrentOAuthToken(context.Context, identity.Requester) *oauth2.Token
	IsOAuthPassThruEnabled(*datasources.DataSource) bool
	HasOAuthEntry(context.Context, identity.Requester) (*login.UserAuth, bool, error)
	TryTokenRefresh(context.Context, identity.Requester) error
	InvalidateOAuthTokens(context.Context, *login.UserAuth) error
}

func ProvideService(socialService social.Service, authInfoService login.AuthInfoService, cfg *setting.Cfg, registerer prometheus.Registerer) *Service {
	return &Service{
		AuthInfoService:      authInfoService,
		Cfg:                  cfg,
		SocialService:        socialService,
		cache:                localcache.New(maxOAuthTokenCacheTTL, 15*time.Minute),
		singleFlightGroup:    new(singleflight.Group),
		tokenRefreshDuration: newTokenRefreshDurationMetric(registerer),
	}
}

// GetCurrentOAuthToken returns the OAuth token, if any, for the authenticated user. Will try to refresh the token if it has expired.
func (o *Service) GetCurrentOAuthToken(ctx context.Context, usr identity.Requester) *oauth2.Token {
	authInfo, ok, _ := o.HasOAuthEntry(ctx, usr)
	if !ok {
		return nil
	}

	token, err := o.tryGetOrRefreshOAuthToken(ctx, authInfo)
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
	if namespace != identity.TypeUser {
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
// It uses a singleflight.Group to prevent getting the Refresh Token multiple times for a given User
func (o *Service) TryTokenRefresh(ctx context.Context, usr identity.Requester) error {
	if usr == nil || usr.IsNil() {
		logger.Warn("Can only refresh OAuth tokens for existing users", "user", "nil")
		// Not user, no token.
		return nil
	}

	namespace, id := usr.GetNamespacedID()
	if namespace != identity.TypeUser {
		// Not a user, therefore no token.
		logger.Warn("Can only refresh OAuth tokens for users", "namespace", namespace, "userId", id)
		return nil
	}

	ctxLogger := logger.FromContext(ctx)

	userID, err := identity.IntIdentifier(namespace, id)
	if err != nil {
		ctxLogger.Warn("Failed to convert user id to int", "namespace", namespace, "userId", id, "error", err)
		return nil
	}

	ctxLogger = ctxLogger.New("userID", userID)

	lockKey := fmt.Sprintf("oauth-refresh-token-%d", userID)
	if _, ok := o.cache.Get(lockKey); ok {
		ctxLogger.Debug("Expiration check has been cached, no need to refresh")
		return nil
	}
	_, err, _ = o.singleFlightGroup.Do(lockKey, func() (any, error) {
		ctxLogger.Debug("Singleflight request for getting a new access token", "key", lockKey)

		authInfo, exists, err := o.HasOAuthEntry(ctx, usr)
		if !exists {
			if err != nil {
				ctxLogger.Debug("Failed to fetch oauth entry", "error", err)
			} else {
				// User is not logged in via OAuth no need to check
				o.cache.Set(lockKey, struct{}{}, maxOAuthTokenCacheTTL)
			}
			return nil, nil
		}

		_, needRefresh, ttl := needTokenRefresh(authInfo)
		if !needRefresh {
			o.cache.Set(lockKey, struct{}{}, ttl)
			return nil, nil
		}

		// get the token's auth provider (f.e. azuread)
		provider := strings.TrimPrefix(authInfo.AuthModule, "oauth_")
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

		return o.tryGetOrRefreshOAuthToken(ctx, authInfo)
	})
	// Silence ErrNoRefreshTokenFound
	if errors.Is(err, ErrNoRefreshTokenFound) {
		return nil
	}

	return err
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
func (o *Service) InvalidateOAuthTokens(ctx context.Context, usr *login.UserAuth) error {
	return o.AuthInfoService.UpdateAuthInfo(ctx, &login.UpdateAuthInfoCommand{
		UserId:     usr.UserId,
		AuthModule: usr.AuthModule,
		AuthId:     usr.AuthId,
		OAuthToken: &oauth2.Token{
			AccessToken:  "",
			RefreshToken: "",
			Expiry:       time.Time{},
		},
	})
}

func (o *Service) tryGetOrRefreshOAuthToken(ctx context.Context, usr *login.UserAuth) (*oauth2.Token, error) {
	ctxLogger := logger.FromContext(ctx).New("userID", usr.UserId)

	key := getCheckCacheKey(usr.UserId)
	if _, ok := o.cache.Get(key); ok {
		ctxLogger.Debug("Expiration check has been cached", "userID", usr.UserId)
		return buildOAuthTokenFromAuthInfo(usr), nil
	}

	if err := checkOAuthRefreshToken(usr); err != nil {
		return nil, err
	}

	persistedToken, refreshNeeded, ttl := needTokenRefresh(usr)
	if !refreshNeeded {
		o.cache.Set(key, struct{}{}, ttl)
		return persistedToken, nil
	}

	authProvider := usr.AuthModule
	connect, err := o.SocialService.GetConnector(authProvider)
	if err != nil {
		ctxLogger.Error("Failed to get oauth connector", "provider", authProvider, "error", err)
		return nil, err
	}

	client, err := o.SocialService.GetOAuthHttpClient(authProvider)
	if err != nil {
		ctxLogger.Error("Failed to get oauth http client", "provider", authProvider, "error", err)
		return nil, err
	}
	ctx = context.WithValue(ctx, oauth2.HTTPClient, client)

	start := time.Now()
	// TokenSource handles refreshing the token if it has expired
	token, err := connect.TokenSource(ctx, persistedToken).Token()
	duration := time.Since(start)
	o.tokenRefreshDuration.WithLabelValues(authProvider, fmt.Sprintf("%t", err == nil)).Observe(duration.Seconds())

	if err != nil {
		ctxLogger.Error("Failed to retrieve oauth access token",
			"provider", usr.AuthModule, "userId", usr.UserId, "error", err)
		return nil, err
	}

	// If the tokens are not the same, update the entry in the DB
	if !tokensEq(persistedToken, token) {
		updateAuthCommand := &login.UpdateAuthInfoCommand{
			UserId:     usr.UserId,
			AuthModule: usr.AuthModule,
			AuthId:     usr.AuthId,
			OAuthToken: token,
		}

		if o.Cfg.Env == setting.Dev {
			ctxLogger.Debug("Oauth got token",
				"auth_module", usr.AuthModule,
				"expiry", fmt.Sprintf("%v", token.Expiry),
				"access_token", fmt.Sprintf("%v", token.AccessToken),
				"refresh_token", fmt.Sprintf("%v", token.RefreshToken),
			)
		}

		if err := o.AuthInfoService.UpdateAuthInfo(ctx, updateAuthCommand); err != nil {
			ctxLogger.Error("Failed to update auth info during token refresh", "userId", usr.UserId, "error", err)
			return nil, err
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

func needTokenRefresh(usr *login.UserAuth) (*oauth2.Token, bool, time.Duration) {
	var accessTokenExpires, idTokenExpires time.Time
	var hasAccessTokenExpired, hasIdTokenExpired bool

	persistedToken := buildOAuthTokenFromAuthInfo(usr)
	idTokenExp, err := getIDTokenExpiry(usr)
	if err != nil {
		logger.Warn("Could not get ID Token expiry", "error", err)
	}
	if !persistedToken.Expiry.IsZero() {
		accessTokenExpires, hasAccessTokenExpired = getExpiryWithSkew(persistedToken.Expiry)
	}
	if !idTokenExp.IsZero() {
		idTokenExpires, hasIdTokenExpired = getExpiryWithSkew(idTokenExp)
	}
	if !hasAccessTokenExpired && !hasIdTokenExpired {
		logger.Debug("Neither access nor id token have expired yet", "userID", usr.UserId)
		return persistedToken, false, getOAuthTokenCacheTTL(accessTokenExpires, idTokenExpires)
	}
	if hasIdTokenExpired {
		// Force refreshing token when id token is expired
		persistedToken.AccessToken = ""
	}
	return persistedToken, true, time.Second
}

func getCheckCacheKey(usrID int64) string {
	return fmt.Sprintf("token-check-%d", usrID)
}

func getOAuthTokenCacheTTL(accessTokenExpiry, idTokenExpiry time.Time) time.Duration {
	min := maxOAuthTokenCacheTTL
	if !accessTokenExpiry.IsZero() {
		d := time.Until(accessTokenExpiry)
		if d < min {
			min = d
		}
	}
	if !idTokenExpiry.IsZero() {
		d := time.Until(idTokenExpiry)
		if d < min {
			min = d
		}
	}
	if accessTokenExpiry.IsZero() && idTokenExpiry.IsZero() {
		return maxOAuthTokenCacheTTL
	}
	return min
}

// getIDTokenExpiry extracts the expiry time from the ID token
func getIDTokenExpiry(usr *login.UserAuth) (time.Time, error) {
	if usr.OAuthIdToken == "" {
		return time.Time{}, nil
	}

	parsedToken, err := jwt.ParseSigned(usr.OAuthIdToken)
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

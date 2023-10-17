package clients

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var _ authn.HookClient = new(Session)
var _ authn.ContextAwareClient = new(Session)

func ProvideSession(
	cfg *setting.Cfg, features *featuremgmt.FeatureManager, sessionService auth.UserTokenService,
	oauthTokenService oauthtoken.OAuthTokenService, socialService social.Service,
) *Session {
	return &Session{
		cfg:               cfg,
		features:          features,
		sessionService:    sessionService,
		oauthTokenService: oauthTokenService,
		socialService:     socialService,
		log:               log.New(authn.ClientSession),
		cache:             localcache.New(maxOAuthTokenCacheTTL, 15*time.Minute),
	}
}

type Session struct {
	log      log.Logger
	cfg      *setting.Cfg
	features *featuremgmt.FeatureManager

	socialService     social.Service
	sessionService    auth.UserTokenService
	oauthTokenService oauthtoken.OAuthTokenService

	cache *localcache.CacheService
}

func (s *Session) Name() string {
	return authn.ClientSession
}

func (s *Session) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	unescapedCookie, err := r.HTTPRequest.Cookie(s.cfg.LoginCookieName)
	if err != nil {
		return nil, err
	}

	rawSessionToken, err := url.QueryUnescape(unescapedCookie.Value)
	if err != nil {
		return nil, err
	}

	token, err := s.sessionService.LookupToken(ctx, rawSessionToken)
	if err != nil {
		return nil, err
	}

	if s.features.IsEnabled(featuremgmt.FlagClientTokenRotation) {
		if token.NeedsRotation(time.Duration(s.cfg.TokenRotationIntervalMinutes) * time.Minute) {
			return nil, authn.ErrTokenNeedsRotation.Errorf("token needs to be rotated")
		}
	}

	return &authn.Identity{
		ID:           authn.NamespacedID(authn.NamespaceUser, token.UserId),
		SessionToken: token,
		ClientParams: authn.ClientParams{
			FetchSyncedUser: true,
			SyncPermissions: true,
		},
	}, nil
}

func (s *Session) Test(ctx context.Context, r *authn.Request) bool {
	if s.cfg.LoginCookieName == "" {
		return false
	}

	if _, err := r.HTTPRequest.Cookie(s.cfg.LoginCookieName); err != nil {
		return false
	}

	return true
}

func (s *Session) Priority() uint {
	return 60
}

func (s *Session) Hook(ctx context.Context, identity *authn.Identity, r *authn.Request) error {
	if identity.SessionToken == nil {
		return nil
	}

	if err := s.rotateTokenHook(ctx, identity, r); err != nil {
		return err
	}

	return s.syncOAuthTokenHook(ctx, identity, r)
}

func (s *Session) rotateTokenHook(ctx context.Context, identity *authn.Identity, r *authn.Request) error {
	if s.features.IsEnabled(featuremgmt.FlagClientTokenRotation) {
		return nil
	}

	r.Resp.Before(func(w web.ResponseWriter) {
		if w.Written() || errors.Is(ctx.Err(), context.Canceled) {
			return
		}

		// FIXME (jguer): get real values
		addr := web.RemoteAddr(r.HTTPRequest)
		userAgent := r.HTTPRequest.UserAgent()

		// addr := reqContext.RemoteAddr()
		ip, err := network.GetIPFromAddress(addr)
		if err != nil {
			s.log.Debug("Failed to get client IP address", "addr", addr, "err", err)
			ip = nil
		}
		rotated, newToken, err := s.sessionService.TryRotateToken(ctx, identity.SessionToken, ip, userAgent)
		if err != nil {
			s.log.Error("Failed to rotate token", "error", err)
			return
		}

		if rotated {
			identity.SessionToken = newToken
			s.log.Debug("Rotated session token", "user", identity.ID)

			authn.WriteSessionCookie(w, s.cfg, identity.SessionToken)
		}
	})

	return nil
}

func (s *Session) syncOAuthTokenHook(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	if !s.features.IsEnabled(featuremgmt.FlagAccessTokenExpirationCheck) {
		return nil
	}

	namespace, id := identity.NamespacedID()
	// only perform oauth token check if identity is a user
	if namespace != authn.NamespaceUser {
		return nil
	}

	// if we recently have performed this it would be cached, so we can skip the hook
	if _, ok := s.cache.Get(identity.ID); ok {
		return nil
	}

	token, exists, _ := s.oauthTokenService.HasOAuthEntry(ctx, &user.SignedInUser{UserID: id})
	// user is not authenticated through oauth so skip further checks
	if !exists {
		// if user is not authenticated through oauth we can skip this check by adding the id to the cache
		s.cache.Set(identity.ID, struct{}{}, maxOAuthTokenCacheTTL)
		return nil
	}

	// get the token's auth provider (f.e. azuread)
	provider := strings.TrimPrefix(token.AuthModule, "oauth_")
	currentOAuthInfo := s.socialService.GetOAuthInfoProvider(provider)
	if currentOAuthInfo == nil {
		s.log.Warn("OAuth provider not found", "provider", provider)
		return nil
	}

	// if refresh token handling is disabled for this provider, we can skip the hook
	if !currentOAuthInfo.UseRefreshToken {
		// refresh token is not configured for provider so we can skip this check by adding the id to the cache
		s.cache.Set(identity.ID, struct{}{}, maxOAuthTokenCacheTTL)
		return nil
	}

	idTokenExpiry, err := getIDTokenExpiry(token)
	if err != nil {
		s.log.FromContext(ctx).Error("Failed to extract expiry of ID token", "id", identity.ID, "error", err)
	}

	// token has no expire time configured, so we don't have to refresh it
	if token.OAuthExpiry.IsZero() {
		// cache the token check, so we don't perform it on every request
		s.cache.Set(identity.ID, struct{}{}, getOAuthTokenCacheTTL(token.OAuthExpiry, idTokenExpiry))
		return nil
	}

	accessTokenExpires := token.OAuthExpiry.Round(0).Add(-oauthtoken.ExpiryDelta)

	hasIdTokenExpired := false
	idTokenExpires := time.Time{}

	if !idTokenExpiry.IsZero() {
		idTokenExpires = idTokenExpiry.Round(0).Add(-oauthtoken.ExpiryDelta)
		hasIdTokenExpired = idTokenExpires.Before(time.Now())
	}

	// token has not expired, so we don't have to refresh it
	if !accessTokenExpires.Before(time.Now()) && !hasIdTokenExpired {
		// cache the token check, so we don't perform it on every request
		s.cache.Set(identity.ID, struct{}{}, getOAuthTokenCacheTTL(accessTokenExpires, idTokenExpires))
		return nil
	}
	// FIXME: Consider using context.WithoutCancel instead of context.Background after Go 1.21 update
	updateCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := s.oauthTokenService.TryTokenRefresh(updateCtx, token); err != nil {
		if errors.Is(err, context.Canceled) {
			return nil
		}
		if !errors.Is(err, oauthtoken.ErrNoRefreshTokenFound) {
			s.log.Error("Failed to refresh OAuth access token", "id", identity.ID, "error", err)
		}

		if err := s.oauthTokenService.InvalidateOAuthTokens(ctx, token); err != nil {
			s.log.Warn("Failed to invalidate OAuth tokens", "id", identity.ID, "error", err)
		}

		if err := s.sessionService.RevokeToken(ctx, identity.SessionToken, false); err != nil {
			s.log.Warn("Failed to revoke session token", "id", identity.ID, "tokenId", identity.SessionToken.Id, "error", err)
		}

		return authn.ErrExpiredAccessToken.Errorf("oauth access token could not be refreshed: %w", err)
	}

	return nil
}

const maxOAuthTokenCacheTTL = 10 * time.Minute

func getOAuthTokenCacheTTL(accessTokenExpiry, idTokenExpiry time.Time) time.Duration {
	if accessTokenExpiry.IsZero() && idTokenExpiry.IsZero() {
		return maxOAuthTokenCacheTTL
	}

	min := func(a, b time.Duration) time.Duration {
		if a <= b {
			return a
		}
		return b
	}

	if accessTokenExpiry.IsZero() && !idTokenExpiry.IsZero() {
		return min(time.Until(idTokenExpiry), maxOAuthTokenCacheTTL)
	}

	if !accessTokenExpiry.IsZero() && idTokenExpiry.IsZero() {
		return min(time.Until(accessTokenExpiry), maxOAuthTokenCacheTTL)
	}

	return min(min(time.Until(accessTokenExpiry), time.Until(idTokenExpiry)), maxOAuthTokenCacheTTL)
}

// getIDTokenExpiry extracts the expiry time from the ID token
func getIDTokenExpiry(token *login.UserAuth) (time.Time, error) {
	if token.OAuthIdToken == "" {
		return time.Time{}, nil
	}

	parsedToken, err := jwt.ParseSigned(token.OAuthIdToken)
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

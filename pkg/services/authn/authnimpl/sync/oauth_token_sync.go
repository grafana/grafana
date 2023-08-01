package sync

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errExpiredAccessToken = errutil.NewBase(
		errutil.StatusUnauthorized,
		"oauth.expired-token",
		errutil.WithPublicMessage("OAuth access token expired"))
)

func ProvideOAuthTokenSync(service oauthtoken.OAuthTokenService, sessionService auth.UserTokenService, socialService social.Service) *OAuthTokenSync {
	return &OAuthTokenSync{
		log.New("oauth_token.sync"),
		localcache.New(maxOAuthTokenCacheTTL, 15*time.Minute),
		service,
		sessionService,
		socialService,
	}
}

type OAuthTokenSync struct {
	log            log.Logger
	cache          *localcache.CacheService
	service        oauthtoken.OAuthTokenService
	sessionService auth.UserTokenService
	socialService  social.Service
}

func (s *OAuthTokenSync) SyncOauthTokenHook(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	namespace, id := identity.NamespacedID()
	// only perform oauth token check if identity is a user
	if namespace != authn.NamespaceUser {
		return nil
	}

	// not authenticated through session tokens, so we can skip this hook
	if identity.SessionToken == nil {
		return nil
	}

	// if we recently have performed this it would be cached, so we can skip the hook
	if _, ok := s.cache.Get(identity.ID); ok {
		return nil
	}

	token, exists, _ := s.service.HasOAuthEntry(ctx, &user.SignedInUser{UserID: id})
	// user is not authenticated through oauth so skip further checks
	if !exists {
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

	// get the token's auth provider (f.e. azuread)
	provider := strings.TrimPrefix(token.AuthModule, "oauth_")
	currentOAuthInfo := s.socialService.GetOAuthInfoProvider(provider)
	if currentOAuthInfo == nil {
		s.log.Warn("OAuth provider not found", "provider", provider)
		return nil
	}

	// if refresh token handling is disabled for this provider, we can skip the hook
	if !currentOAuthInfo.UseRefreshToken {
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

	if err := s.service.TryTokenRefresh(ctx, token); err != nil {
		if !errors.Is(err, oauthtoken.ErrNoRefreshTokenFound) {
			s.log.FromContext(ctx).Error("Failed to refresh OAuth access token", "id", identity.ID, "error", err)
		}

		if err := s.service.InvalidateOAuthTokens(ctx, token); err != nil {
			s.log.FromContext(ctx).Error("Failed to invalidate OAuth tokens", "id", identity.ID, "error", err)
		}

		if err := s.sessionService.RevokeToken(ctx, identity.SessionToken, false); err != nil {
			s.log.FromContext(ctx).Error("Failed to revoke session token", "id", identity.ID, "tokenId", identity.SessionToken.Id, "error", err)
		}

		return errExpiredAccessToken.Errorf("oauth access token could not be refreshed: %w", err)
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

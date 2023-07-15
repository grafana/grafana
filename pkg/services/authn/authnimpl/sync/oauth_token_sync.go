package sync

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
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

	// token has no expire time configured, so we don't have to refresh it
	if token.OAuthExpiry.IsZero() {
		// cache the token check, so we don't perform it on every request
		s.cache.Set(identity.ID, struct{}{}, getOAuthTokenCacheTTL(token.OAuthExpiry))
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

	expires := token.OAuthExpiry.Round(0).Add(-oauthtoken.ExpiryDelta)
	// token has not expired, so we don't have to refresh it
	if !expires.Before(time.Now()) {
		// cache the token check, so we don't perform it on every request
		s.cache.Set(identity.ID, struct{}{}, getOAuthTokenCacheTTL(expires))
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

func getOAuthTokenCacheTTL(t time.Time) time.Duration {
	if t.IsZero() {
		return maxOAuthTokenCacheTTL
	}

	ttl := time.Until(t)
	if ttl > maxOAuthTokenCacheTTL {
		return maxOAuthTokenCacheTTL
	}

	return ttl
}

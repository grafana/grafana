package sync

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errExpiredAccessToken = errutil.NewBase(errutil.StatusUnauthorized, "oauth.expired-token")
)

func ProvideOAuthTokenSync(service oauthtoken.OAuthTokenService, sessionService auth.UserTokenService) *OAuthTokenSync {
	return &OAuthTokenSync{
		log.New("oauth_token.sync"),
		localcache.New(maxOAuthTokenCacheTTL, 15*time.Minute),
		service,
		sessionService,
	}
}

type OAuthTokenSync struct {
	log            log.Logger
	cache          *localcache.CacheService
	service        oauthtoken.OAuthTokenService
	sessionService auth.UserTokenService
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
			s.log.FromContext(ctx).Error("Failed invalidate OAuth tokens", "id", identity.ID, "error", err)
		}

		if err := s.sessionService.RevokeToken(ctx, identity.SessionToken, false); err != nil {
			s.log.FromContext(ctx).Error("Failed to revoke session token", "id", identity.ID, "tokenId", identity.SessionToken.Id, "error", err)
		}

		return errExpiredAccessToken.Errorf("oauth access token could not be refreshed: %w", auth.ErrInvalidSessionToken)
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

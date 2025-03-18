package sync

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/authlib/claims"
	"golang.org/x/oauth2"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
)

const maxOAuthTokenCacheTTL = 5 * time.Minute

func ProvideOAuthTokenSync(service oauthtoken.OAuthTokenService, sessionService auth.UserTokenService, socialService social.Service, tracer tracing.Tracer,
	features featuremgmt.FeatureToggles,
) *OAuthTokenSync {
	return &OAuthTokenSync{
		log.New("oauth_token.sync"),
		service,
		sessionService,
		socialService,
		new(singleflight.Group),
		tracer,
		localcache.New(maxOAuthTokenCacheTTL, 15*time.Minute),
		features,
	}
}

type OAuthTokenSync struct {
	log               log.Logger
	service           oauthtoken.OAuthTokenService
	sessionService    auth.UserTokenService
	socialService     social.Service
	singleflightGroup *singleflight.Group
	tracer            tracing.Tracer
	cache             *localcache.CacheService
	features          featuremgmt.FeatureToggles
}

func (s *OAuthTokenSync) SyncOauthTokenHook(ctx context.Context, id *authn.Identity, _ *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "oauth.sync.SyncOauthTokenHook")
	defer span.End()

	// only perform oauth token check if identity is a user
	if !id.IsIdentityType(claims.TypeUser) {
		return nil
	}

	// Not authenticated through session tokens, so we can skip this hook.
	if id.SessionToken == nil {
		return nil
	}

	// Not authenticated with a oauth provider, so we can skip this hook.
	if !strings.HasPrefix(id.GetAuthenticatedBy(), "oauth") {
		return nil
	}

	userID, err := id.GetInternalID()
	if err != nil {
		s.log.FromContext(ctx).Error("Failed to refresh token. Invalid ID for identity", "type", id.GetIdentityType(), "err", err)
		return nil
	}

	ctxLogger := s.log.FromContext(ctx).New("userID", userID)

	cacheKey := fmt.Sprintf("token-check-%s", id.GetID())
	if s.features.IsEnabledGlobally(featuremgmt.FlagImprovedExternalSessionHandling) {
		cacheKey = fmt.Sprintf("token-check-%s-%d", id.GetID(), id.SessionToken.Id)
	}

	if _, ok := s.cache.Get(cacheKey); ok {
		ctxLogger.Debug("Expiration check has been cached, no need to refresh")
		return nil
	}

	_, err, _ = s.singleflightGroup.Do(cacheKey, func() (interface{}, error) {
		ctxLogger.Debug("Singleflight request for OAuth token sync")

		updateCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
		defer cancel()

		token, refreshErr := s.service.TryTokenRefresh(updateCtx, id, id.SessionToken)
		if refreshErr != nil {
			if errors.Is(refreshErr, context.Canceled) {
				return nil, nil
			}

			if errors.Is(refreshErr, oauthtoken.ErrRetriesExhausted) {
				ctxLogger.Warn("Retries have been exhausted for locking the DB for OAuth token refresh", "id", id.ID, "error", refreshErr)
				return nil, refreshErr
			}

			ctxLogger.Error("Failed to refresh OAuth access token", "id", id.ID, "error", refreshErr)

			// log the user out
			if err := s.sessionService.RevokeToken(ctx, id.SessionToken, false); err != nil {
				ctxLogger.Warn("Failed to revoke session token", "id", id.ID, "tokenId", id.SessionToken.Id, "error", err)
			}

			s.cache.Delete(cacheKey)
			return nil, refreshErr
		}

		s.cache.Set(cacheKey, true, getOAuthTokenCacheTTL(token))
		return nil, nil
	})

	if err != nil {
		return authn.ErrExpiredAccessToken.Errorf("OAuth access token could not be refreshed: %w", err)
	}

	return nil
}

func getOAuthTokenCacheTTL(token *oauth2.Token) time.Duration {
	ttl := maxOAuthTokenCacheTTL
	if token == nil {
		return ttl
	}

	if !token.Expiry.IsZero() {
		d := time.Until(token.Expiry.Add(-oauthtoken.ExpiryDelta))
		if d < ttl {
			ttl = d
		}
	}

	idTokenExpiry, err := oauthtoken.GetIDTokenExpiry(token)
	if err == nil && !idTokenExpiry.IsZero() {
		d := time.Until(idTokenExpiry.Add(-oauthtoken.ExpiryDelta))
		if d < ttl {
			ttl = d
		}
	}

	return ttl
}

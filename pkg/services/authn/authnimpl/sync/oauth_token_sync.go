package sync

import (
	"context"
	"errors"
	"strings"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
)

func ProvideOAuthTokenSync(service oauthtoken.OAuthTokenService, sessionService auth.UserTokenService, socialService social.Service, tracer tracing.Tracer) *OAuthTokenSync {
	return &OAuthTokenSync{
		log.New("oauth_token.sync"),
		service,
		sessionService,
		socialService,
		new(singleflight.Group),
		tracer,
	}
}

type OAuthTokenSync struct {
	log               log.Logger
	service           oauthtoken.OAuthTokenService
	sessionService    auth.UserTokenService
	socialService     social.Service
	singleflightGroup *singleflight.Group
	tracer            tracing.Tracer
}

func (s *OAuthTokenSync) SyncOauthTokenHook(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "oauth.sync.SyncOauthTokenHook")
	defer span.End()

	// only perform oauth token check if identity is a user
	if !identity.ID.IsNamespace(authn.NamespaceUser) {
		return nil
	}

	// Not authenticated through session tokens, so we can skip this hook.
	if identity.SessionToken == nil {
		return nil
	}

	// Not authenticated with a oauth provider, so we can skip this hook.
	if !strings.HasPrefix(identity.GetAuthenticatedBy(), "oauth") {
		return nil
	}

	_, err, _ := s.singleflightGroup.Do(identity.ID.String(), func() (interface{}, error) {
		s.log.Debug("Singleflight request for OAuth token sync", "key", identity.ID.String())

		// FIXME: Consider using context.WithoutCancel instead of context.Background after Go 1.21 update
		updateCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		if refreshErr := s.service.TryTokenRefresh(updateCtx, identity); refreshErr != nil {
			if errors.Is(refreshErr, context.Canceled) {
				return nil, nil
			}

			token, _, err := s.service.HasOAuthEntry(ctx, identity)
			if err != nil {
				s.log.Error("Failed to get OAuth entry for verifying if token has already been refreshed", "id", identity.ID, "error", err)
				return nil, err
			}

			// if the access token has already been refreshed by another request (for example in HA scenario)
			tokenExpires := token.OAuthExpiry.Round(0).Add(-oauthtoken.ExpiryDelta)
			if !tokenExpires.Before(time.Now()) {
				return nil, nil
			}

			s.log.Error("Failed to refresh OAuth access token", "id", identity.ID, "error", refreshErr)

			if err := s.service.InvalidateOAuthTokens(ctx, token); err != nil {
				s.log.Warn("Failed to invalidate OAuth tokens", "id", identity.ID, "error", err)
			}

			if err := s.sessionService.RevokeToken(ctx, identity.SessionToken, false); err != nil {
				s.log.Warn("Failed to revoke session token", "id", identity.ID, "tokenId", identity.SessionToken.Id, "error", err)
			}

			return nil, refreshErr
		}
		return nil, nil
	})

	if err != nil {
		return authn.ErrExpiredAccessToken.Errorf("OAuth access token could not be refreshed: %w", err)
	}

	return nil
}

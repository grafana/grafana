package sync

import (
	"context"
	"errors"
	"time"

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

func ProvideOauthTokenSync(service oauthtoken.OAuthTokenService, sessionService auth.UserTokenService) *OauthTokenSync {
	return &OauthTokenSync{
		log.New("oauth_token.sync"),
		service,
		sessionService,
	}
}

type OauthTokenSync struct {
	log            log.Logger
	service        oauthtoken.OAuthTokenService
	sessionService auth.UserTokenService
}

func (s *OauthTokenSync) SyncOauthToken(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	namespace, id := identity.NamespacedID()
	// only perform oauth token check if identity is a user
	if namespace != authn.NamespaceUser {
		return nil
	}

	// not authenticated through session tokens, so we can skip this hook
	if identity.SessionToken == nil {
		return nil
	}

	token, exists, _ := s.service.HasOAuthEntry(ctx, &user.SignedInUser{UserID: id})
	// user is not authenticated through oauth so skip further checks
	if !exists {
		return nil
	}

	// token has no expire time configured, so we don't have to refresh it
	if token.OAuthExpiry.IsZero() {
		return nil
	}

	// token has not expired, so we don't have to refresh it
	if !token.OAuthExpiry.Round(0).Add(-oauthtoken.ExpiryDelta).Before(time.Now()) {
		return nil
	}

	if err := s.service.TryTokenRefresh(ctx, token); err != nil {
		if !errors.Is(err, oauthtoken.ErrNoRefreshTokenFound) {
			s.log.FromContext(ctx).Error("could not refresh oauth access token for user", "userId", id, "err", err)
		}

		if err := s.service.InvalidateOAuthTokens(ctx, token); err != nil {
			s.log.FromContext(ctx).Error("could not invalidate OAuth tokens", "userId", id, "err", err)
		}

		if err := s.sessionService.RevokeToken(ctx, identity.SessionToken, false); err != nil {
			s.log.FromContext(ctx).Error("could not revoke token", "userId", id, "tokenId", identity.SessionToken.Id, "err", err)
		}

		return errExpiredAccessToken.Errorf("oauth access token could not be refreshed: %w", auth.ErrInvalidSessionToken)
	}

	return nil
}

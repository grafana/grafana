package clients

import (
	"context"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authn.ContextAwareClient = new(Session)

func ProvideSession(cfg *setting.Cfg, sessionService auth.UserTokenService) *Session {
	return &Session{
		cfg:            cfg,
		sessionService: sessionService,
		log:            log.New(authn.ClientSession),
	}
}

type Session struct {
	cfg            *setting.Cfg
	sessionService auth.UserTokenService
	log            log.Logger
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

	if token.NeedsRotation(time.Duration(s.cfg.TokenRotationIntervalMinutes) * time.Minute) {
		return nil, authn.ErrTokenNeedsRotation.Errorf("token needs to be rotated")
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

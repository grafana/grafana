package clients

import (
	"context"
	"errors"
	"net/url"
	"strconv"
	"time"

	"go.opentelemetry.io/otel/trace"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authn.ContextAwareClient = new(Session)

func ProvideSession(cfg *setting.Cfg, sessionService auth.UserTokenService,
	authInfoService login.AuthInfoService, tracer trace.Tracer) *Session {
	return &Session{
		cfg:             cfg,
		log:             log.New(authn.ClientSession),
		sessionService:  sessionService,
		authInfoService: authInfoService,
		tracer:          tracer,
	}
}

type Session struct {
	cfg             *setting.Cfg
	log             log.Logger
	sessionService  auth.UserTokenService
	authInfoService login.AuthInfoService
	tracer          trace.Tracer
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

	ident := &authn.Identity{
		ID:           strconv.FormatInt(token.UserId, 10),
		Type:         claims.TypeUser,
		SessionToken: token,
		ClientParams: authn.ClientParams{
			FetchSyncedUser: true,
			SyncPermissions: true,
		},
	}

	info, err := s.authInfoService.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: token.UserId})
	if err != nil {
		if !errors.Is(err, user.ErrUserNotFound) {
			s.log.FromContext(ctx).Error("Failed to fetch auth info", "err", err)
		}
		return ident, nil
	}

	ident.AuthID = info.AuthId
	ident.AuthenticatedBy = info.AuthModule
	return ident, nil
}

func (s *Session) IsEnabled() bool {
	return true
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

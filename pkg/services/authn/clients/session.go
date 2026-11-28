package clients

import (
	"context"
	"errors"
	"net/url"
	"strconv"
	"time"

	"go.opentelemetry.io/otel/trace"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

var _ authn.ContextAwareClient = (*Session)(nil)

func ProvideSession(cfgProvider configprovider.ConfigProvider, sessionService auth.UserTokenService,
	authInfoService login.AuthInfoService, tracer trace.Tracer) *Session {
	return &Session{
		cfgProvider:     cfgProvider,
		log:             log.New(authn.ClientSession),
		sessionService:  sessionService,
		authInfoService: authInfoService,
		tracer:          tracer,
	}
}

type Session struct {
	cfgProvider     configprovider.ConfigProvider
	log             log.Logger
	sessionService  auth.UserTokenService
	authInfoService login.AuthInfoService
	tracer          trace.Tracer
}

func (s *Session) Name() string {
	return authn.ClientSession
}

func (s *Session) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	cfg, err := s.cfgProvider.Get(ctx)
	if err != nil {
		return nil, err
	}

	unescapedCookie, err := r.HTTPRequest.Cookie(cfg.LoginCookieName)
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

	if token.NeedsRotation(time.Duration(cfg.TokenRotationIntervalMinutes) * time.Minute) {
		return nil, authn.NewTokenNeedsRotationError(token.UserId)
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

	info, err := s.getSessionAuthInfo(ctx, token)
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

// getSessionAuthInfo returns the auth info of the login that created the session.
// The most recent auth info of the user is not always that login: a user who signed in
// with OAuth and then calls the API with a JWT gets a newer "jwt" entry, but a JWT
// never creates a session.
func (s *Session) getSessionAuthInfo(ctx context.Context, token *auth.UserToken) (*login.UserAuth, error) {
	info, err := s.authInfoService.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: token.UserId})
	if err != nil {
		return nil, err
	}

	if info.AuthModule != login.JWTModule && info.AuthModule != login.ExtendedJWTModule {
		return info, nil
	}

	// Sessions created by an external login keep a link to it, other sessions (e.g. basic
	// login) have no auth info.
	if token.ExternalSessionId == 0 {
		return nil, user.ErrUserNotFound
	}

	externalSession, err := s.sessionService.GetExternalSession(ctx, token.ExternalSessionId)
	if err != nil {
		if errors.Is(err, auth.ErrExternalSessionNotFound) {
			return nil, user.ErrUserNotFound
		}
		return nil, err
	}

	return s.authInfoService.GetAuthInfo(ctx, &login.GetAuthInfoQuery{
		UserId:     token.UserId,
		AuthModule: externalSession.AuthModule,
	})
}

func (s *Session) IsEnabled(context.Context) bool {
	return true
}

func (s *Session) Test(ctx context.Context, r *authn.Request) bool {
	cfg, err := s.cfgProvider.Get(ctx)
	if err != nil {
		s.log.FromContext(ctx).Error("Failed to load config", "err", err)
		return false
	}

	if cfg.LoginCookieName == "" {
		return false
	}

	if _, err := r.HTTPRequest.Cookie(cfg.LoginCookieName); err != nil {
		return false
	}

	return true
}

func (s *Session) Priority() uint {
	return 60
}

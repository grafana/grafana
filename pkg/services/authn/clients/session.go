package clients

import (
	"context"
	"errors"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

var _ authn.ContextAwareClient = new(Session)

func ProvideSession(sessionService auth.UserTokenService, userService user.Service,
	cookieName string, maxLifetime time.Duration) *Session {
	return &Session{
		loginCookieName:  cookieName,
		loginMaxLifetime: maxLifetime,
		sessionService:   sessionService,
		userService:      userService,
		log:              log.New(authn.ClientSession),
	}
}

type Session struct {
	loginCookieName  string
	loginMaxLifetime time.Duration // jguer: should be returned by session Service on rotate
	sessionService   auth.UserTokenService
	userService      user.Service
	log              log.Logger
}

func (s *Session) Name() string {
	return authn.ClientSession
}

func (s *Session) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	unescapedCookie, err := r.HTTPRequest.Cookie(s.loginCookieName)
	if err != nil {
		return nil, err
	}

	rawSessionToken, err := url.QueryUnescape(unescapedCookie.Value)
	if err != nil {
		return nil, err
	}

	token, err := s.sessionService.LookupToken(ctx, rawSessionToken)
	if err != nil {
		s.log.Warn("failed to look up session from cookie", "error", err)
		return nil, err
	}

	signedInUser, err := s.userService.GetSignedInUserWithCacheCtx(ctx,
		&user.GetSignedInUserQuery{UserID: token.UserId, OrgID: r.OrgID})
	if err != nil {
		s.log.Error("failed to get user with id", "userId", token.UserId, "error", err)
		return nil, err
	}

	// FIXME (jguer): oauth token refresh not implemented
	identity := authn.IdentityFromSignedInUser(authn.NamespacedID(authn.NamespaceUser, signedInUser.UserID), signedInUser, authn.ClientParams{})
	identity.SessionToken = token

	return identity, nil
}

func (s *Session) Test(ctx context.Context, r *authn.Request) bool {
	if s.loginCookieName == "" {
		return false
	}

	if _, err := r.HTTPRequest.Cookie(s.loginCookieName); err != nil {
		return false
	}

	return true
}

func (s *Session) Priority() uint {
	return 60
}

func (s *Session) RefreshTokenHook(ctx context.Context, identity *authn.Identity, r *authn.Request) error {
	if identity.SessionToken == nil {
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
			s.log.Debug("failed to get client IP address", "addr", addr, "err", err)
			ip = nil
		}
		rotated, newToken, err := s.sessionService.TryRotateToken(ctx, identity.SessionToken, ip, userAgent)
		if err != nil {
			s.log.Error("failed to rotate token", "error", err)
			return
		}

		if rotated {
			identity.SessionToken = newToken
			s.log.Debug("rotated session token", "user", identity.ID)

			maxAge := int(s.loginMaxLifetime.Seconds())
			if s.loginMaxLifetime <= 0 {
				maxAge = -1
			}
			cookies.WriteCookie(r.Resp, s.loginCookieName, url.QueryEscape(identity.SessionToken.UnhashedToken), maxAge, nil)
		}
	})

	return nil
}

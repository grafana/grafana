package clients

import (
	"context"
	"fmt"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/user"
)

func ProvideSession(sessionService auth.UserTokenService, userService user.Service, cookieName string) *Session {
	return &Session{
		loginCookieName: cookieName,
		sessionService:  sessionService,
		userService:     userService,
		log:             log.New(authn.ClientSession),
	}
}

type Session struct {
	loginCookieName string
	sessionService  auth.UserTokenService
	userService     user.Service
	log             log.Logger
}

func (s *Session) ClientParams() *authn.ClientParams {
	return &authn.ClientParams{
		SyncUser:            false,
		AllowSignUp:         false,
		EnableDisabledUsers: false,
	}
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

func (s *Session) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	if s.loginCookieName == "" { // FIXME: this should be handled by Test
		return nil, nil
	}

	// get cookie from request
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
		// TODO (jguer): delete cookie if token is not found
		s.log.Warn("failed to look up session from cookie", "error", err)
		return nil, err
	}

	signedInUser, err := s.userService.GetSignedInUserWithCacheCtx(ctx,
		&user.GetSignedInUserQuery{UserID: token.UserId, OrgID: r.OrgID})
	if err != nil {
		s.log.Error("Failed to get user with id", "userId", token.UserId, "error", err)
		return nil, err
	}

	// FIXME (jguer): oauth token refresh not implemented

	return authn.IdentityFromSignedInUser(fmt.Sprintf("%s%d", authn.UserIDPrefix, signedInUser.UserID), signedInUser), nil
}

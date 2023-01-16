package clients

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/web"
)

var (
	errDecodingBasicAuthHeader = errutil.NewBase(errutil.StatusBadRequest, "basic-auth.invalid-header", errutil.WithPublicMessage("Invalid Basic Auth Header"))
	errBasicAuthCredentials    = errutil.NewBase(errutil.StatusUnauthorized, "basic-auth.invalid-credentials", errutil.WithPublicMessage("Invalid username or password"))
)

var _ authn.Client = new(Basic)

func ProvideBasic(loginAttempts loginattempt.Service, clients ...authn.PasswordClient) *Basic {
	return &Basic{clients, loginAttempts}
}

type Basic struct {
	clients       []authn.PasswordClient
	loginAttempts loginattempt.Service
}

func (c *Basic) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	username, password, err := util.DecodeBasicAuthHeader(getBasicAuthHeaderFromRequest(r))
	if err != nil {
		return nil, errDecodingBasicAuthHeader.Errorf("failed to decode basic auth header: %w", err)
	}

	r.SetMeta(authn.MetaKeyUsername, username)

	ok, err := c.loginAttempts.Validate(ctx, username)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errBasicAuthCredentials.Errorf("too many consecutive incorrect login attempts for user - login for user temporarily blocked")
	}

	if len(password) == 0 {
		return nil, errBasicAuthCredentials.Errorf("no password provided")
	}

	for _, pwClient := range c.clients {
		identity, err := pwClient.AuthenticatePassword(ctx, r, username, password)
		if err != nil {
			if errors.Is(err, errIdentityNotFound) {
				// continue to next password client if identity could not be found
				continue
			}
			if errors.Is(err, errInvalidPassword) {
				// only add login attempt if identity was found but the provided password was invalid
				_ = c.loginAttempts.Add(ctx, username, web.RemoteAddr(r.HTTPRequest))
			}
			return nil, errBasicAuthCredentials.Errorf("failed to authenticate identity: %w", err)
		}

		return identity, nil
	}

	return nil, errBasicAuthCredentials.Errorf("failed to authenticate identity using basic auth")
}

func (c *Basic) Test(ctx context.Context, r *authn.Request) bool {
	if len(c.clients) == 0 {
		return false
	}
	return looksLikeBasicAuthRequest(r)
}

func looksLikeBasicAuthRequest(r *authn.Request) bool {
	return getBasicAuthHeaderFromRequest(r) != ""
}

func getBasicAuthHeaderFromRequest(r *authn.Request) string {
	if r.HTTPRequest == nil {
		return ""
	}

	header := r.HTTPRequest.Header.Get(authorizationHeaderName)
	if header == "" {
		return ""
	}

	if !strings.HasPrefix(header, basicPrefix) {
		return ""
	}

	return header
}

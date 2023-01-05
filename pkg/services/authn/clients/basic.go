package clients

import (
	"context"
	"crypto/subtle"
	"strings"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrBasicAuthCredentials    = errutil.NewBase(errutil.StatusUnauthorized, "basic-auth.invalid-credentials", errutil.WithPublicMessage("Invalid username or password"))
	ErrDecodingBasicAuthHeader = errutil.NewBase(errutil.StatusBadRequest, "basic-auth.invalid-header", errutil.WithPublicMessage("Invalid Basic Auth Header"))
)

var _ authn.Client = new(Basic)

func ProvideBasic(userService user.Service, loginAttempts loginattempt.Service) *Basic {
	return &Basic{userService, loginAttempts}
}

type Basic struct {
	userService   user.Service
	loginAttempts loginattempt.Service
}

func (c *Basic) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	username, password, err := util.DecodeBasicAuthHeader(getBasicAuthHeaderFromRequest(r))
	if err != nil {
		return nil, ErrDecodingBasicAuthHeader.Errorf("failed to decode basic auth header: %w", err)
	}

	ok, err := c.loginAttempts.Validate(ctx, username)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrBasicAuthCredentials.Errorf("too many consecutive incorrect login attempts for user - login for user temporarily blocked")
	}

	if len(password) == 0 {
		return nil, ErrBasicAuthCredentials.Errorf("no password provided")
	}

	// FIXME (kalleep): decide if we should handle ldap here
	usr, err := c.userService.GetByLogin(ctx, &user.GetUserByLoginQuery{LoginOrEmail: username})
	if err != nil {
		return nil, ErrBasicAuthCredentials.Errorf("failed to fetch user: %w", err)
	}

	if ok := comparePassword(password, usr.Salt, usr.Password); !ok {
		_ = c.loginAttempts.Add(ctx, username, r.HTTPRequest.RemoteAddr)
		return nil, ErrBasicAuthCredentials.Errorf("incorrect password provided")
	}

	signedInUser, err := c.userService.GetSignedInUserWithCacheCtx(ctx, &user.GetSignedInUserQuery{
		UserID: usr.ID,
		OrgID:  r.OrgID,
	})

	if err != nil {
		return nil, ErrBasicAuthCredentials.Errorf("failed to fetch user: %w", err)
	}

	return authn.IdentityFromSignedInUser(authn.NamespacedID(authn.NamespaceUser, signedInUser.UserID), signedInUser, authn.ClientParams{}), nil
}

func (c *Basic) Test(ctx context.Context, r *authn.Request) bool {
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

func comparePassword(password, salt, hash string) bool {
	// It is ok to ignore the error here because util.EncodePassword can never return a error
	hashedPassword, _ := util.EncodePassword(password, salt)
	return subtle.ConstantTimeCompare([]byte(hashedPassword), []byte(hash)) == 1
}

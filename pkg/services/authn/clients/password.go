package clients

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/web"
)

var (
	errEmptyPassword       = errutil.NewBase(errutil.StatusBadRequest, "password-auth.empty", errutil.WithPublicMessage("Invalid username or password"))
	errPasswordAuthFailed  = errutil.NewBase(errutil.StatusBadRequest, "password-auth.failed", errutil.WithPublicMessage("Invalid username or password"))
	errInvalidPassword     = errutil.NewBase(errutil.StatusBadRequest, "password-auth.invalid", errutil.WithPublicMessage("Invalid password or username"))
	errLoginAttemptBlocked = errutil.NewBase(errutil.StatusUnauthorized, "login-attempt.blocked", errutil.WithPublicMessage("Invalid username or password"))
)

var _ authn.PasswordClient = new(Password)

func ProvidePassword(loginAttempts loginattempt.Service, clients ...authn.PasswordClient) *Password {
	return &Password{loginAttempts, clients}
}

type Password struct {
	loginAttempts loginattempt.Service
	clients       []authn.PasswordClient
}

func (c *Password) AuthenticatePassword(ctx context.Context, r *authn.Request, username, password string) (*authn.Identity, error) {
	r.SetMeta(authn.MetaKeyUsername, username)

	ok, err := c.loginAttempts.Validate(ctx, username)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errLoginAttemptBlocked.Errorf("too many consecutive incorrect login attempts for user - login for user temporarily blocked")
	}

	if len(password) == 0 {
		return nil, errEmptyPassword.Errorf("no password provided")
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
				return nil, err
			}
			return nil, errPasswordAuthFailed.Errorf("failed to authenticate identity: %w", err)
		}

		return identity, nil
	}

	return nil, errPasswordAuthFailed.Errorf("failed to authenticate identity")
}

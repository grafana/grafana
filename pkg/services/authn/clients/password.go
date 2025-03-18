package clients

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/web"
)

var (
	errInvalidPassword    = errutil.Unauthorized("password-auth.invalid", errutil.WithPublicMessage("Invalid password or username"))
	errPasswordAuthFailed = errutil.Unauthorized("password-auth.failed", errutil.WithPublicMessage("Invalid username or password"))
)

var _ authn.PasswordClient = new(Password)

func ProvidePassword(loginAttempts loginattempt.Service, clients ...authn.PasswordClient) *Password {
	return &Password{loginAttempts, clients, log.New("authn.password")}
}

type Password struct {
	loginAttempts loginattempt.Service
	clients       []authn.PasswordClient
	log           log.Logger
}

func (c *Password) AuthenticatePassword(ctx context.Context, r *authn.Request, username, password string) (*authn.Identity, error) {
	r.SetMeta(authn.MetaKeyUsername, username)

	ok, err := c.loginAttempts.Validate(ctx, username)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errPasswordAuthFailed.Errorf("too many consecutive incorrect login attempts for user - login for user temporarily blocked")
	}

	if len(password) == 0 {
		return nil, errPasswordAuthFailed.Errorf("no password provided")
	}

	var clientErrs error
	for _, pwClient := range c.clients {
		identity, clientErr := pwClient.AuthenticatePassword(ctx, r, username, password)
		clientErrs = errors.Join(clientErrs, clientErr)
		// we always try next client on any error
		if clientErr != nil {
			c.log.FromContext(ctx).Debug("Failed to authenticate password identity", "client", pwClient, "error", clientErr)
			continue
		}

		return identity, nil
	}

	if errors.Is(clientErrs, errInvalidPassword) {
		_ = c.loginAttempts.Add(ctx, username, web.RemoteAddr(r.HTTPRequest))
	}

	return nil, errPasswordAuthFailed.Errorf("failed to authenticate identity: %w", clientErrs)
}

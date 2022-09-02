package login

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	ErrEmailNotAllowed       = errors.New("required email domain not fulfilled")
	ErrInvalidCredentials    = errors.New("invalid username or password")
	ErrNoEmail               = errors.New("login provider didn't return an email address")
	ErrProviderDeniedRequest = errors.New("login provider denied login request")
	ErrTooManyLoginAttempts  = errors.New("too many consecutive incorrect login attempts for user - login for user temporarily blocked")
	ErrPasswordEmpty         = errors.New("no password provided")
	ErrUserDisabled          = errors.New("user is disabled")
	ErrAbsoluteRedirectTo    = errors.New("absolute URLs are not allowed for redirect_to cookie value")
	ErrInvalidRedirectTo     = errors.New("invalid redirect_to cookie value")
	ErrForbiddenRedirectTo   = errors.New("forbidden redirect_to cookie value")
)

var loginLogger = log.New("login")

type Authenticator interface {
	AuthenticateUser(context.Context, *models.LoginUserQuery) error
}

type AuthenticatorService struct {
	loginService        login.Service
	loginAttemptService loginattempt.Service
	userService         user.Service
}

func ProvideService(store sqlstore.Store, loginService login.Service, loginAttemptService loginattempt.Service, userService user.Service) *AuthenticatorService {
	a := &AuthenticatorService{
		loginService:        loginService,
		loginAttemptService: loginAttemptService,
		userService:         userService,
	}
	return a
}

// AuthenticateUser authenticates the user via username & password
func (a *AuthenticatorService) AuthenticateUser(ctx context.Context, query *models.LoginUserQuery) error {
	if err := validateLoginAttempts(ctx, query, a.loginAttemptService); err != nil {
		return err
	}

	if err := validatePasswordSet(query.Password); err != nil {
		return err
	}

	err := loginUsingGrafanaDB(ctx, query, a.userService)
	if err == nil || (!errors.Is(err, user.ErrUserNotFound) && !errors.Is(err, ErrInvalidCredentials) &&
		!errors.Is(err, ErrUserDisabled)) {
		query.AuthModule = "grafana"
		return err
	}

	ldapEnabled, ldapErr := loginUsingLDAP(ctx, query, a.loginService)
	if ldapEnabled {
		query.AuthModule = login.LDAPAuthModule
		if ldapErr == nil || !errors.Is(ldapErr, ldap.ErrInvalidCredentials) {
			return ldapErr
		}

		if !errors.Is(err, ErrUserDisabled) || !errors.Is(ldapErr, ldap.ErrInvalidCredentials) {
			err = ldapErr
		}
	}

	if errors.Is(err, ErrInvalidCredentials) || errors.Is(err, ldap.ErrInvalidCredentials) {
		if err := saveInvalidLoginAttempt(ctx, query, a.loginAttemptService); err != nil {
			loginLogger.Error("Failed to save invalid login attempt", "err", err)
		}

		return ErrInvalidCredentials
	}

	return err
}

func validatePasswordSet(password string) error {
	if len(password) == 0 {
		return ErrPasswordEmpty
	}

	return nil
}

package login

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
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
	ErrNoAuthProvider        = errors.New("enable at least one login provider")
)

var loginLogger = log.New("login")

type Authenticator interface {
	AuthenticateUser(context.Context, *login.LoginUserQuery) error
}

type AuthenticatorService struct {
	loginService        login.Service
	loginAttemptService loginattempt.Service
	userService         user.Service
	cfg                 *setting.Cfg
}

func ProvideService(store db.DB, loginService login.Service,
	loginAttemptService loginattempt.Service,
	userService user.Service, cfg *setting.Cfg) *AuthenticatorService {
	a := &AuthenticatorService{
		loginService:        loginService,
		loginAttemptService: loginAttemptService,
		userService:         userService,
		cfg:                 cfg,
	}
	return a
}

// AuthenticateUser authenticates the user via username & password
func (a *AuthenticatorService) AuthenticateUser(ctx context.Context, query *login.LoginUserQuery) error {
	ok, err := a.loginAttemptService.Validate(ctx, query.Username)
	if err != nil {
		return err
	}
	if !ok {
		return ErrTooManyLoginAttempts
	}

	if err := validatePasswordSet(query.Password); err != nil {
		return err
	}

	isGrafanaLoginEnabled := !query.Cfg.DisableLogin

	if isGrafanaLoginEnabled {
		err = loginUsingGrafanaDB(ctx, query, a.userService)
	}

	if isGrafanaLoginEnabled && (err == nil || (!errors.Is(err, user.ErrUserNotFound) && !errors.Is(err, ErrInvalidCredentials) &&
		!errors.Is(err, ErrUserDisabled))) {
		query.AuthModule = "grafana"
		return err
	}

	ldapEnabled, ldapErr := loginUsingLDAP(ctx, query, a.loginService, a.cfg)
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
		if err := a.loginAttemptService.Add(ctx, query.Username, query.IpAddress); err != nil {
			loginLogger.Error("Failed to save invalid login attempt", "err", err)
		}

		return ErrInvalidCredentials
	}

	if !isGrafanaLoginEnabled && !ldapEnabled {
		return ErrNoAuthProvider
	}

	return err
}

func validatePasswordSet(password string) error {
	if len(password) == 0 {
		return ErrPasswordEmpty
	}

	return nil
}

package login

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// getLDAPConfig gets LDAP config
var getLDAPConfig = multildap.GetConfig

// newLDAP creates multiple LDAP instance
var newLDAP = multildap.New

// logger for the LDAP auth
var ldapLogger = log.New("login.ldap")

// loginUsingLDAP logs in user using LDAP. It returns whether LDAP is enabled and optional error and query arg will be
// populated with the logged in user if successful.
var loginUsingLDAP = func(ctx context.Context, query *login.LoginUserQuery,
	loginService login.Service, userService user.Service, authInfoService login.AuthInfoService, cfg *setting.Cfg) (bool, error) {
	if !cfg.LDAPAuthEnabled {
		return false, nil
	}

	config, err := getLDAPConfig(query.Cfg)
	if err != nil {
		return true, fmt.Errorf("%v: %w", "Failed to get LDAP config", err)
	}

	externalUser, err := newLDAP(config.Servers).Login(query)
	if err != nil {
		if errors.Is(err, ldap.ErrCouldNotFindUser) {
			ldapLogger.Debug("user was not found in the LDAP directory tree", "username", query.Username)
			retErr := ldap.ErrInvalidCredentials

			// Retrieve the user from store based on the login
			dbUser, errGet := userService.GetByLogin(ctx, &user.GetUserByLoginQuery{
				LoginOrEmail: query.Username,
			})
			if errors.Is(errGet, user.ErrUserNotFound) {
				return true, retErr
			} else if errGet != nil {
				return true, errGet
			}

			// Check if the user logged in via LDAP
			authModuleQuery := &login.GetAuthInfoQuery{UserId: dbUser.ID, AuthModule: login.LDAPAuthModule}
			errGetAuthInfo := authInfoService.GetAuthInfo(ctx, authModuleQuery)
			if errors.Is(errGetAuthInfo, user.ErrUserNotFound) {
				return true, retErr
			} else if errGetAuthInfo != nil {
				return true, errGetAuthInfo
			}

			// Disable the user
			ldapLogger.Debug("user was removed from the LDAP directory tree, disabling it", "username", query.Username, "authID", authModuleQuery.Result.AuthId)
			if errDisable := loginService.DisableExternalUser(ctx, query.Username); errDisable != nil {
				ldapLogger.Debug("Failed to disable external user", "err", errDisable)
				return true, errDisable
			}

			// Return invalid credentials if we couldn't find the user anywhere
			return true, retErr
		}

		return true, err
	}

	upsert := &login.UpsertUserCommand{
		ReqContext:    query.ReqContext,
		ExternalUser:  externalUser,
		SignupAllowed: setting.LDAPAllowSignup,
		UserLookupParams: login.UserLookupParams{
			Login:  &externalUser.Login,
			Email:  &externalUser.Email,
			UserID: nil,
		},
	}
	if err = loginService.UpsertUser(ctx, upsert); err != nil {
		return true, err
	}
	query.User = upsert.Result

	return true, nil
}

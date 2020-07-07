package login

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// getLDAPConfig gets LDAP config
var getLDAPConfig = multildap.GetConfig

// isLDAPEnabled checks if LDAP is enabled
var isLDAPEnabled = multildap.IsEnabled

// newLDAP creates multiple LDAP instance
var newLDAP = multildap.New

// logger for the LDAP auth
var ldapLogger = log.New("login.ldap")

// loginUsingLDAP logs in user using LDAP. It returns whether LDAP is enabled and optional error and query arg will be
// populated with the logged in user if successful.
var loginUsingLDAP = func(query *models.LoginUserQuery) (bool, error) {
	enabled := isLDAPEnabled()

	if !enabled {
		return false, nil
	}

	config, err := getLDAPConfig()
	if err != nil {
		return true, errutil.Wrap("Failed to get LDAP config", err)
	}

	externalUser, err := newLDAP(config.Servers).Login(query)
	if err != nil {
		if err == ldap.ErrCouldNotFindUser {
			// Ignore the error since user might not be present anyway
			if err := DisableExternalUser(query.Username); err != nil {
				ldapLogger.Debug("Failed to disable external user", "err", err)
			}

			return true, ldap.ErrInvalidCredentials
		}

		return true, err
	}

	upsert := &models.UpsertUserCommand{
		ReqContext:    query.ReqContext,
		ExternalUser:  externalUser,
		SignupAllowed: setting.LDAPAllowSignup,
	}
	err = bus.Dispatch(upsert)
	if err != nil {
		return true, err
	}
	query.User = upsert.Result

	return true, nil
}

// DisableExternalUser marks external user as disabled in Grafana db
func DisableExternalUser(username string) error {
	// Check if external user exist in Grafana
	userQuery := &models.GetExternalUserInfoByLoginQuery{
		LoginOrEmail: username,
	}

	if err := bus.Dispatch(userQuery); err != nil {
		return err
	}

	userInfo := userQuery.Result
	if !userInfo.IsDisabled {
		ldapLogger.Debug(
			"Disabling external user",
			"user",
			userQuery.Result.Login,
		)

		// Mark user as disabled in grafana db
		disableUserCmd := &models.DisableUserCommand{
			UserId:     userQuery.Result.UserId,
			IsDisabled: true,
		}

		if err := bus.Dispatch(disableUserCmd); err != nil {
			ldapLogger.Debug(
				"Error disabling external user",
				"user",
				userQuery.Result.Login,
				"message",
				err.Error(),
			)
			return err
		}
	}
	return nil
}

package login

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
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
		return true, err
	}

	upsert := &models.UpsertUserCommand{
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

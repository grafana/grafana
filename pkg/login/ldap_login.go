package login

import (
	"github.com/grafana/grafana/pkg/models"
	MultipleLDAP "github.com/grafana/grafana/pkg/services/multipleldap"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// getLDAPConfig gets LDAP config
var getLDAPConfig = MultipleLDAP.GetConfig

// isLDAPEnabled checks if LDAP is enabled
var isLDAPEnabled = MultipleLDAP.IsEnabled

// newLDAP creates multiple LDAP instance
var newLDAP = MultipleLDAP.New

// loginUsingLdap logs in user using LDAP. It returns whether LDAP is enabled and optional error and query arg will be
// populated with the logged in user if successful.
var loginUsingLdap = func(query *models.LoginUserQuery) (bool, error) {
	enabled := isLDAPEnabled()

	if !enabled {
		return false, nil
	}

	config, err := getLDAPConfig()
	if err != nil {
		return true, errutil.Wrap("Failed to get LDAP config", err)
	}
	if len(config.Servers) == 0 {
		return true, ErrNoLDAPServers
	}

	externalUser, err := newLDAP(config.Servers).Login(query)
	if err != nil {
		return true, err
	}

	login, err := user.Upsert(&user.UpsertArgs{
		ExternalUser:  externalUser,
		SignupAllowed: setting.LdapAllowSignup,
	})
	if err != nil {
		return true, err
	}

	query.User = login

	return true, nil
}

package login

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/multipleldap"
	LDAP "github.com/grafana/grafana/pkg/services/multipleldap"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var getLDAPConfig = LDAP.GetConfig
var isLDAPEnabled = LDAP.IsEnabled

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

	multipleldap.New(config.Servers)

	externalUser, err := auth.Login(query)
	if err == nil || err != LDAP.ErrInvalidCredentials {
		return true, err
	}

	_, err := user.Upsert(externalUser, setting.LdapAllowSignup)
	if err != nil {
		return true, err
	}

	return true, LDAP.ErrInvalidCredentials
}

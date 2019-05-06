package login

import (
	"github.com/grafana/grafana/pkg/models"
	LDAP "github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var newLDAP = LDAP.New
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

	for _, server := range config.Servers {
		auth := newLDAP(server)

		err := auth.Login(query)
		if err == nil || err != LDAP.ErrInvalidCredentials {
			return true, err
		}
	}

	return true, LDAP.ErrInvalidCredentials
}

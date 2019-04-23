package login

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	LDAP "github.com/grafana/grafana/pkg/services/ldap"
)

var loginUsingLdap = func(query *models.LoginUserQuery) (bool, error) {
	enabled, config := LDAP.ReadConfig()

	if !enabled {
		return false, nil
	}

	for _, server := range config.Servers {
		author := ldap.New(server)
		err := author.Login(query)
		if err == nil || err != ErrInvalidCredentials {
			return true, err
		}
	}

	return true, ErrInvalidCredentials
}

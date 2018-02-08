package login

import (
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var loginUsingLdap = func(ctx *m.ReqContext, query *m.LoginUserQuery) (bool, error) {
	if !setting.LdapEnabled {
		return false, nil
	}

	for _, server := range LdapCfg.Servers {
		author := NewLdapAuthenticator(server)
		err := author.Login(ctx, query)
		if err == nil || err != ErrInvalidCredentials {
			return true, err
		}
	}

	return true, ErrInvalidCredentials
}

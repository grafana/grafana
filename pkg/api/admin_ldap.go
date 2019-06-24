package api

import (
	"github.com/grafana/grafana/pkg/services/ldap"
)

func (server *HTTPServer) ReloadLDAPCfg() Response {
	if !ldap.IsEnabled() {
		return Error(400, "LDAP is not enabled", nil)
	}

	err := ldap.ReloadConfig()
	if err != nil {
		return Error(500, "Failed to reload ldap config.", err)
	}
	return Success("LDAP config reloaded")
}

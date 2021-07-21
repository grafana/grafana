package api

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// API related actions
const (
	ActionProvisioningReload = "provisioning:reload"
)

// API related scopes
const (
	ScopeServicesAll           = "services:*"
	ScopeServicesDashboards    = "services:dashboards"
	ScopeServicesPlugins       = "services:plugins"
	ScopeServicesDatasources   = "services:datasources"
	ScopeServicesNotifications = "services:notifications"
)

// addFixedRoles registers fixed roles and their grants to organization roles
// ("Viewer", "Editor", "Admin") or "Grafana Admin" that HTTPServer needs
func (hs *HTTPServer) addFixedRoles() error {
	registration := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     1,
			Name:        "fixed:provisioning:admin",
			Description: "Reload provisioning configurations",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningReload,
					Scope:  ScopeServicesAll,
				},
			},
		},
		Grants: []string{accesscontrol.RoleGrafanaAdmin},
	}

	return hs.AccessControl.AddFixedRoles(registration)
}

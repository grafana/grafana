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

// GetFixedRoleRegistrations returns the list of fixed roles and their grants to organization roles
// ("Viewer", "Editor", "Admin") or "Grafana Admin" that HTTPServer needs
func (hs *HTTPServer) AddFixedRoleRegistrations() {
	registrations := []accesscontrol.RoleRegistration{
		{
			Role: accesscontrol.RoleDTO{
				Version:     1,
				Name:        "fixed:provisioning:admin",
				Description: "Reload provisioning services",
				Permissions: []accesscontrol.Permission{
					{
						Action: ActionProvisioningReload,
						Scope:  ScopeServicesAll,
					},
				},
			},
			Grants: []string{accesscontrol.RoleGrafanaAdmin},
		},
	}

	hs.AccessControl.AddFixedRoleRegistrations(registrations)
}

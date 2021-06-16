package api

import (
	"context"

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

// registerRoles creates Grafana Fixed roles and grants them to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
func (hs *HTTPServer) registerRoles() {
	provisioningAdmin := accesscontrol.RoleDTO{
		Version:     1,
		Name:        "fixed:provisioning:admin",
		Description: "Reload provisioning services",
		Permissions: []accesscontrol.Permission{
			{
				Action: ActionProvisioningReload,
				Scope:  ScopeServicesAll,
			},
		},
	}

	hs.AccessControl.RegisterFixedRole(context.TODO(), provisioningAdmin, accesscontrol.RoleGrafanaAdmin)

}

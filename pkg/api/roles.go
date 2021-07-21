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
	ScopeProvisionersAll           = "provisioners:*"
	ScopeProvisionersDashboards    = "provisioners:dashboards"
	ScopeProvisionersPlugins       = "provisioners:plugins"
	ScopeProvisionersDatasources   = "provisioners:datasources"
	ScopeProvisionersNotifications = "provisioners:notifications"
)

// declareFixedRoles declares to the AccessControl service fixed roles and their
// grants to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
// that HTTPServer needs
func (hs *HTTPServer) declareFixedRoles() error {
	registration := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     1,
			Name:        "fixed:provisioning:admin",
			Description: "Reload provisioning configurations",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningReload,
					Scope:  ScopeProvisionersAll,
				},
			},
		},
		Grants: []string{accesscontrol.RoleGrafanaAdmin},
	}

	return hs.AccessControl.DeclareFixedRoles(registration)
}

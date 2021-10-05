package api

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// API related actions
const (
	ActionProvisioningReload = "provisioning:reload"

	ActionDatasourcesRead   = "datasources:read"
	ActionDatasourcesCreate = "datasources:create"
	ActionDatasourcesWrite  = "datasources:write"
	ActionDatasourcesDelete = "datasources:delete"
	ActionDatasourcesIDRead = "datasources.id:read"
)

// API related scopes
const (
	ScopeProvisionersAll           = "provisioners:*"
	ScopeProvisionersDashboards    = "provisioners:dashboards"
	ScopeProvisionersPlugins       = "provisioners:plugins"
	ScopeProvisionersDatasources   = "provisioners:datasources"
	ScopeProvisionersNotifications = "provisioners:notifications"

	ScopeDatasourcesAll = `datasources:*`
	ScopeDatasourceID   = `datasources:id:{{ index . ":id" }}`
	ScopeDatasourceUID  = `datasources:uid:{{ index . ":uid" }}`
	ScopeDatasourceName = `datasources:name:{{ index . ":name" }}`
)

// declareFixedRoles declares to the AccessControl service fixed roles and their
// grants to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
// that HTTPServer needs
func (hs *HTTPServer) declareFixedRoles() error {
	registrations := []accesscontrol.RoleRegistration{
		{
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
		},
		{
			Role: accesscontrol.RoleDTO{
				Version:     1,
				Name:        "fixed:datasources:admin",
				Description: "Gives access to create, read, update, delete datasources",
				Permissions: []accesscontrol.Permission{
					{
						Action: ActionDatasourcesRead,
						Scope:  ScopeDatasourcesAll,
					},
					{
						Action: ActionDatasourcesWrite,
						Scope:  ScopeDatasourcesAll,
					},
					{Action: ActionDatasourcesCreate},
					{
						Action: ActionDatasourcesDelete,
						Scope:  ScopeDatasourcesAll,
					},
				},
			},
			Grants: []string{string(models.ROLE_ADMIN)},
		},
		{
			Role: accesscontrol.RoleDTO{
				Version:     2,
				Name:        "fixed:datasources:id:viewer",
				Description: "Gives access to read datasources ID",
				Permissions: []accesscontrol.Permission{
					{
						Action: ActionDatasourcesIDRead,
						Scope:  ScopeDatasourcesAll,
					},
				},
			},
			Grants: []string{string(models.ROLE_VIEWER)},
		},
	}

	return hs.AccessControl.DeclareFixedRoles(registrations...)
}

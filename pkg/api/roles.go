package api

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// API related actions
const (
	ActionProvisioningReload = "provisioning:reload"

	ActionDatasourcesRead   = "datasources:read"
	ActionDatasourcesQuery  = "datasources:query"
	ActionDatasourcesCreate = "datasources:create"
	ActionDatasourcesWrite  = "datasources:write"
	ActionDatasourcesDelete = "datasources:delete"
	ActionDatasourcesIDRead = "datasources.id:read"

	ActionOrgsRead             = "orgs:read"
	ActionOrgsPreferencesRead  = "orgs.preferences:read"
	ActionOrgsQuotasRead       = "orgs.quotas:read"
	ActionOrgsWrite            = "orgs:write"
	ActionOrgsPreferencesWrite = "orgs.preferences:write"
	ActionOrgsQuotasWrite      = "orgs.quotas:write"
	ActionOrgsDelete           = "orgs:delete"
	ActionOrgsCreate           = "orgs:create"

	ActionTeamsCreate = "teams:create"
)

// API related scopes
var (
	ScopeProvisionersAll           = accesscontrol.Scope("provisioners", "*")
	ScopeProvisionersDashboards    = accesscontrol.Scope("provisioners", "dashboards")
	ScopeProvisionersPlugins       = accesscontrol.Scope("provisioners", "plugins")
	ScopeProvisionersDatasources   = accesscontrol.Scope("provisioners", "datasources")
	ScopeProvisionersNotifications = accesscontrol.Scope("provisioners", "notifications")

	ScopeDatasourcesAll = accesscontrol.Scope("datasources", "*")
	ScopeDatasourceID   = accesscontrol.Scope("datasources", "id", accesscontrol.Parameter(":id"))
	ScopeDatasourceUID  = accesscontrol.Scope("datasources", "uid", accesscontrol.Parameter(":uid"))
	ScopeDatasourceName = accesscontrol.Scope("datasources", "name", accesscontrol.Parameter(":name"))
)

// declareFixedRoles declares to the AccessControl service fixed roles and their
// grants to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
// that HTTPServer needs
func (hs *HTTPServer) declareFixedRoles() error {
	provisioningWriterRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     3,
			Name:        "fixed:provisioning:writer",
			DisplayName: "Provisioning writer",
			Description: "Reload provisioning.",
			Group:       "Provisioning",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningReload,
					Scope:  ScopeProvisionersAll,
				},
			},
		},
		Grants: []string{accesscontrol.RoleGrafanaAdmin},
	}

	datasourcesReaderRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     3,
			Name:        "fixed:datasources:reader",
			DisplayName: "Data source reader",
			Description: "Read and query all data sources.",
			Group:       "Data sources",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionDatasourcesRead,
					Scope:  ScopeDatasourcesAll,
				},
				{
					Action: ActionDatasourcesQuery,
					Scope:  ScopeDatasourcesAll,
				},
			},
		},
		Grants: []string{string(models.ROLE_ADMIN)},
	}

	datasourcesWriterRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     3,
			Name:        "fixed:datasources:writer",
			DisplayName: "Data source writer",
			Description: "Create, update, delete, read, or query data sources.",
			Group:       "Data sources",
			Permissions: accesscontrol.ConcatPermissions(datasourcesReaderRole.Role.Permissions, []accesscontrol.Permission{
				{
					Action: ActionDatasourcesWrite,
					Scope:  ScopeDatasourcesAll,
				},
				{
					Action: ActionDatasourcesCreate,
				},
				{
					Action: ActionDatasourcesDelete,
					Scope:  ScopeDatasourcesAll,
				},
			}),
		},
		Grants: []string{string(models.ROLE_ADMIN)},
	}

	datasourcesIdReaderRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     4,
			Name:        "fixed:datasources.id:reader",
			DisplayName: "Data source ID reader",
			Description: "Read the ID of a data source based on its name.",
			Group:       "Infrequently used",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionDatasourcesIDRead,
					Scope:  ScopeDatasourcesAll,
				},
			},
		},
		Grants: []string{string(models.ROLE_VIEWER)},
	}

	datasourcesCompatibilityReaderRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     3,
			Name:        "fixed:datasources:compatibility:querier",
			DisplayName: "Data source compatibility querier",
			Description: "Only used for open source compatibility. Query data sources.",
			Group:       "Infrequently used",
			Permissions: []accesscontrol.Permission{
				{Action: ActionDatasourcesQuery},
			},
		},
		Grants: []string{string(models.ROLE_VIEWER)},
	}

	orgReaderRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     5,
			Name:        "fixed:organization:reader",
			DisplayName: "Organization reader",
			Description: "Read an organization, such as its ID, name, address, or quotas.",
			Group:       "Organizations",
			Permissions: []accesscontrol.Permission{
				{Action: ActionOrgsRead},
				{Action: ActionOrgsQuotasRead},
			},
		},
		Grants: []string{string(models.ROLE_VIEWER), accesscontrol.RoleGrafanaAdmin},
	}

	orgWriterRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     5,
			Name:        "fixed:organization:writer",
			DisplayName: "Organization writer",
			Description: "Read an organization, its quotas, or its preferences. Update organization properties, or its preferences.",
			Group:       "Organizations",
			Permissions: accesscontrol.ConcatPermissions(orgReaderRole.Role.Permissions, []accesscontrol.Permission{
				{Action: ActionOrgsPreferencesRead},
				{Action: ActionOrgsWrite},
				{Action: ActionOrgsPreferencesWrite},
			}),
		},
		Grants: []string{string(models.ROLE_ADMIN)},
	}

	orgMaintainerRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     5,
			Name:        "fixed:organization:maintainer",
			DisplayName: "Organization maintainer",
			Description: "Create, read, write, or delete an organization. Read or write an organization's quotas. Needs to be assigned globally.",
			Group:       "Organizations",
			Permissions: accesscontrol.ConcatPermissions(orgReaderRole.Role.Permissions, []accesscontrol.Permission{
				{Action: ActionOrgsCreate},
				{Action: ActionOrgsWrite},
				{Action: ActionOrgsDelete},
				{Action: ActionOrgsQuotasWrite},
			}),
		},
		Grants: []string{string(accesscontrol.RoleGrafanaAdmin)},
	}

	teamWriterGrants := []string{string(models.ROLE_ADMIN)}
	if hs.Cfg.EditorsCanAdmin {
		teamWriterGrants = append(teamWriterGrants, string(models.ROLE_EDITOR))
	}
	teamsWriterRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:teams:writer",
			DisplayName: "Team writer",
			Description: "Create teams.",
			Group:       "Teams",
			Version:     1,
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionTeamsCreate,
				},
			},
		},
		Grants: teamWriterGrants,
	}

	return hs.AccessControl.DeclareFixedRoles(
		provisioningWriterRole, datasourcesReaderRole, datasourcesWriterRole, datasourcesIdReaderRole,
		datasourcesCompatibilityReaderRole, orgReaderRole, orgWriterRole, orgMaintainerRole, teamsWriterRole,
	)
}

// Evaluators
// here is the list of complex evaluators we use in this package

// dataSourcesConfigurationAccessEvaluator is used to protect the "Configure > Data sources" tab access
var dataSourcesConfigurationAccessEvaluator = accesscontrol.EvalAll(
	accesscontrol.EvalPermission(ActionDatasourcesRead, ScopeDatasourcesAll),
	accesscontrol.EvalAny(
		accesscontrol.EvalPermission(ActionDatasourcesCreate),
		accesscontrol.EvalPermission(ActionDatasourcesDelete),
		accesscontrol.EvalPermission(ActionDatasourcesWrite),
	),
)

// dataSourcesNewAccessEvaluator is used to protect the "Configure > Data sources > New" page access
var dataSourcesNewAccessEvaluator = accesscontrol.EvalAll(
	accesscontrol.EvalPermission(ActionDatasourcesRead, ScopeDatasourcesAll),
	accesscontrol.EvalPermission(ActionDatasourcesCreate),
	accesscontrol.EvalPermission(ActionDatasourcesWrite),
)

// dataSourcesEditAccessEvaluator is used to protect the "Configure > Data sources > Edit" page access
var dataSourcesEditAccessEvaluator = accesscontrol.EvalAll(
	accesscontrol.EvalPermission(ActionDatasourcesRead, ScopeDatasourcesAll),
	accesscontrol.EvalPermission(ActionDatasourcesWrite),
)

// orgPreferencesAccessEvaluator is used to protect the "Configure > Preferences" page access
var orgPreferencesAccessEvaluator = accesscontrol.EvalAny(
	accesscontrol.EvalAll(
		accesscontrol.EvalPermission(ActionOrgsRead),
		accesscontrol.EvalPermission(ActionOrgsWrite),
	),
	accesscontrol.EvalAll(
		accesscontrol.EvalPermission(ActionOrgsPreferencesRead),
		accesscontrol.EvalPermission(ActionOrgsPreferencesWrite),
	),
)

// orgsAccessEvaluator is used to protect the "Server Admin > Orgs" page access
// (you need to have read access to update or delete orgs; read is the minimum)
var orgsAccessEvaluator = accesscontrol.EvalPermission(ActionOrgsRead)

// orgsCreateAccessEvaluator is used to protect the "Server Admin > Orgs > New Org" page access
var orgsCreateAccessEvaluator = accesscontrol.EvalAll(
	accesscontrol.EvalPermission(ActionOrgsRead),
	accesscontrol.EvalPermission(ActionOrgsCreate),
)

package api

import (
	"fmt"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
)

// API related actions
const (
	ActionProvisioningReload = "provisioning:reload"
)

// API related scopes
var (
	ScopeProvisionersAll           = ac.Scope("provisioners", "*")
	ScopeProvisionersDashboards    = ac.Scope("provisioners", "dashboards")
	ScopeProvisionersPlugins       = ac.Scope("provisioners", "plugins")
	ScopeProvisionersDatasources   = ac.Scope("provisioners", "datasources")
	ScopeProvisionersNotifications = ac.Scope("provisioners", "notifications")
	ScopeProvisionersAlertRules    = ac.Scope("provisioners", "alerting")
)

// declareFixedRoles declares to the AccessControl service fixed roles and their
// grants to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
// that HTTPServer needs
func (hs *HTTPServer) declareFixedRoles() error {
	// Declare plugins roles
	if err := pluginaccesscontrol.DeclareRBACRoles(hs.accesscontrolService, hs.Cfg); err != nil {
		return err
	}

	provisioningWriterRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:provisioning:writer",
			DisplayName: "Provisioning writer",
			Description: "Reload provisioning.",
			Group:       "Provisioning",
			Permissions: []ac.Permission{
				{
					Action: ActionProvisioningReload,
					Scope:  ScopeProvisionersAll,
				},
			},
		},
		Grants: []string{ac.RoleGrafanaAdmin},
	}

	datasourcesExplorerRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:datasources:explorer",
			DisplayName: "Data source explorer",
			Description: "Enable the Explore feature. Data source permissions still apply; you can only query data sources for which you have query permissions.",
			Group:       "Data sources",
			Permissions: []ac.Permission{
				{
					Action: ac.ActionDatasourcesExplore,
				},
			},
		},
		Grants: []string{string(org.RoleEditor)},
	}

	if hs.Cfg.ViewersCanEdit {
		datasourcesExplorerRole.Grants = append(datasourcesExplorerRole.Grants, string(org.RoleViewer))
	}

	datasourcesReaderRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:datasources:reader",
			DisplayName: "Data source reader",
			Description: "Read and query all data sources.",
			Group:       "Data sources",
			Permissions: []ac.Permission{
				{
					Action: datasources.ActionRead,
					Scope:  datasources.ScopeAll,
				},
				{
					Action: datasources.ActionQuery,
					Scope:  datasources.ScopeAll,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	builtInDatasourceReader := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:datasources.builtin:reader",
			DisplayName: "Built in data source reader",
			Description: "Read and query Grafana's built in test data sources.",
			Group:       "Data sources",
			Permissions: []ac.Permission{
				{
					Action: datasources.ActionRead,
					Scope:  fmt.Sprintf("%s%s", datasources.ScopePrefix, grafanads.DatasourceUID),
				},
				{
					Action: datasources.ActionQuery,
					Scope:  fmt.Sprintf("%s%s", datasources.ScopePrefix, grafanads.DatasourceUID),
				},
			},
			Hidden: true,
		},
		Grants: []string{string(org.RoleViewer)},
	}

	// when running oss or enterprise without a license all users should be able to query data sources
	if !hs.License.FeatureEnabled("dspermissions.enforcement") {
		datasourcesReaderRole.Grants = []string{string(org.RoleViewer)}
	}

	datasourcesWriterRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:datasources:writer",
			DisplayName: "Data source writer",
			Description: "Create, update, delete, read, or query data sources.",
			Group:       "Data sources",
			Permissions: ac.ConcatPermissions(datasourcesReaderRole.Role.Permissions, []ac.Permission{
				{
					Action: datasources.ActionWrite,
					Scope:  datasources.ScopeAll,
				},
				{
					Action: datasources.ActionCreate,
				},
				{
					Action: datasources.ActionDelete,
					Scope:  datasources.ScopeAll,
				},
			}),
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	datasourcesIdReaderRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:datasources.id:reader",
			DisplayName: "Data source ID reader",
			Description: "Read the ID of a data source based on its name.",
			Group:       "Infrequently used",
			Permissions: []ac.Permission{
				{
					Action: datasources.ActionIDRead,
					Scope:  datasources.ScopeAll,
				},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}

	apikeyReaderRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:apikeys:reader",
			DisplayName: "APIKeys reader",
			Description: "Gives access to read api keys.",
			Group:       "API Keys",
			Permissions: []ac.Permission{
				{
					Action: ac.ActionAPIKeyRead,
					Scope:  ac.ScopeAPIKeysAll,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	apikeyWriterRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:apikeys:writer",
			DisplayName: "APIKeys writer",
			Description: "Gives access to add and delete api keys.",
			Group:       "API Keys",
			Permissions: ac.ConcatPermissions(apikeyReaderRole.Role.Permissions, []ac.Permission{
				{
					Action: ac.ActionAPIKeyCreate,
				},
				{
					Action: ac.ActionAPIKeyDelete,
					Scope:  ac.ScopeAPIKeysAll,
				},
			}),
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	orgReaderRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:organization:reader",
			DisplayName: "Organization reader",
			Description: "Read an organization, such as its ID, name, address, or quotas.",
			Group:       "Organizations",
			Permissions: []ac.Permission{
				{Action: ac.ActionOrgsRead},
				{Action: ac.ActionOrgsQuotasRead},
			},
		},
		Grants: []string{string(org.RoleViewer), ac.RoleGrafanaAdmin},
	}

	orgWriterRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:organization:writer",
			DisplayName: "Organization writer",
			Description: "Read an organization, its quotas, or its preferences. Update organization properties, or its preferences.",
			Group:       "Organizations",
			Permissions: ac.ConcatPermissions(orgReaderRole.Role.Permissions, []ac.Permission{
				{Action: ac.ActionOrgsPreferencesRead},
				{Action: ac.ActionOrgsWrite},
				{Action: ac.ActionOrgsPreferencesWrite},
			}),
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	orgMaintainerRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:organization:maintainer",
			DisplayName: "Organization maintainer",
			Description: "Create, read, write, or delete an organization. Read or write an organization's quotas. Needs to be assigned globally.",
			Group:       "Organizations",
			Permissions: ac.ConcatPermissions(orgReaderRole.Role.Permissions, []ac.Permission{
				{Action: ac.ActionOrgsCreate},
				{Action: ac.ActionOrgsWrite},
				{Action: ac.ActionOrgsDelete},
				{Action: ac.ActionOrgsQuotasWrite},
			}),
		},
		Grants: []string{string(ac.RoleGrafanaAdmin)},
	}

	teamCreatorGrants := []string{string(org.RoleAdmin)}
	if hs.Cfg.EditorsCanAdmin {
		teamCreatorGrants = append(teamCreatorGrants, string(org.RoleEditor))
	}
	teamsCreatorRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:teams:creator",
			DisplayName: "Team creator",
			Description: "Create teams and read organisation users (required to manage the created teams).",
			Group:       "Teams",
			Permissions: []ac.Permission{
				{Action: ac.ActionTeamsCreate},
				{Action: ac.ActionOrgUsersRead, Scope: ac.ScopeUsersAll},
			},
		},
		Grants: teamCreatorGrants,
	}

	teamsWriterRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:teams:writer",
			DisplayName: "Team writer",
			Description: "Create, read, write, or delete a team as well as controlling team memberships.",
			Group:       "Teams",
			Permissions: []ac.Permission{
				{Action: ac.ActionTeamsCreate},
				{Action: ac.ActionTeamsDelete, Scope: ac.ScopeTeamsAll},
				{Action: ac.ActionTeamsPermissionsRead, Scope: ac.ScopeTeamsAll},
				{Action: ac.ActionTeamsPermissionsWrite, Scope: ac.ScopeTeamsAll},
				{Action: ac.ActionTeamsRead, Scope: ac.ScopeTeamsAll},
				{Action: ac.ActionTeamsWrite, Scope: ac.ScopeTeamsAll},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	annotationsReaderRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:annotations:reader",
			DisplayName: "Annotation reader",
			Description: "Read annotations and tags",
			Group:       "Annotations",
			Permissions: []ac.Permission{
				{Action: ac.ActionAnnotationsRead, Scope: ac.ScopeAnnotationsAll},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}

	dashboardAnnotationsWriterRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:annotations.dashboard:writer",
			DisplayName: "Dashboard annotation writer",
			Description: "Update annotations associated with dashboards.",
			Group:       "Annotations",
			Permissions: []ac.Permission{
				{Action: ac.ActionAnnotationsCreate, Scope: ac.ScopeAnnotationsTypeDashboard},
				{Action: ac.ActionAnnotationsDelete, Scope: ac.ScopeAnnotationsTypeDashboard},
				{Action: ac.ActionAnnotationsWrite, Scope: ac.ScopeAnnotationsTypeDashboard},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}

	annotationsWriterRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:annotations:writer",
			DisplayName: "Annotation writer",
			Description: "Update all annotations.",
			Group:       "Annotations",
			Permissions: []ac.Permission{
				{Action: ac.ActionAnnotationsCreate, Scope: ac.ScopeAnnotationsAll},
				{Action: ac.ActionAnnotationsDelete, Scope: ac.ScopeAnnotationsAll},
				{Action: ac.ActionAnnotationsWrite, Scope: ac.ScopeAnnotationsAll},
			},
		},
		Grants: []string{string(org.RoleEditor)},
	}

	dashboardsCreatorRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:dashboards:creator",
			DisplayName: "Dashboard creator",
			Description: "Create dashboard in general folder.",
			Group:       "Dashboards",
			Permissions: []ac.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID(ac.GeneralFolderUID)},
				{Action: dashboards.ActionDashboardsCreate, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID(ac.GeneralFolderUID)},
			},
		},
		Grants: []string{"Editor"},
	}

	dashboardsReaderRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:dashboards:reader",
			DisplayName: "Dashboard reader",
			Description: "Read all dashboards.",
			Group:       "Dashboards",
			Permissions: []ac.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeDashboardsAll},
			},
		},
		Grants: []string{"Admin"},
	}

	dashboardsWriterRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:dashboards:writer",
			DisplayName: "Dashboard writer",
			Group:       "Dashboards",
			Description: "Create, read, write or delete all dashboards and their permissions.",
			Permissions: ac.ConcatPermissions(dashboardsReaderRole.Role.Permissions, []ac.Permission{
				{Action: dashboards.ActionDashboardsWrite, Scope: dashboards.ScopeDashboardsAll},
				{Action: dashboards.ActionDashboardsDelete, Scope: dashboards.ScopeDashboardsAll},
				{Action: dashboards.ActionDashboardsCreate, Scope: dashboards.ScopeFoldersAll},
				{Action: dashboards.ActionDashboardsPermissionsRead, Scope: dashboards.ScopeDashboardsAll},
				{Action: dashboards.ActionDashboardsPermissionsWrite, Scope: dashboards.ScopeDashboardsAll},
			}),
		},
		Grants: []string{"Admin"},
	}

	foldersCreatorRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:folders:creator",
			DisplayName: "Folder creator",
			Description: "Create folders.",
			Group:       "Folders",
			Permissions: []ac.Permission{
				{Action: dashboards.ActionFoldersCreate},
			},
		},
		Grants: []string{"Editor"},
	}

	foldersReaderRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:folders:reader",
			DisplayName: "Folder reader",
			Description: "Read all folders and dashboards.",
			Group:       "Folders",
			Permissions: []ac.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeFoldersAll},
			},
		},
		Grants: []string{"Admin"},
	}

	foldersWriterRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:folders:writer",
			DisplayName: "Folder writer",
			Description: "Create, read, write or delete all folders and dashboards and their permissions.",
			Group:       "Folders",
			Permissions: ac.ConcatPermissions(
				foldersReaderRole.Role.Permissions,
				[]ac.Permission{
					{Action: dashboards.ActionFoldersCreate},
					{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll},
					{Action: dashboards.ActionFoldersDelete, Scope: dashboards.ScopeFoldersAll},
					{Action: dashboards.ActionDashboardsWrite, Scope: dashboards.ScopeFoldersAll},
					{Action: dashboards.ActionDashboardsDelete, Scope: dashboards.ScopeFoldersAll},
					{Action: dashboards.ActionDashboardsCreate, Scope: dashboards.ScopeFoldersAll},
					{Action: dashboards.ActionDashboardsPermissionsRead, Scope: dashboards.ScopeFoldersAll},
					{Action: dashboards.ActionDashboardsPermissionsWrite, Scope: dashboards.ScopeFoldersAll},
				}),
		},
		Grants: []string{"Admin"},
	}

	publicDashboardsWriterRole := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        "fixed:dashboards.public:writer",
			DisplayName: "Public Dashboard writer",
			Description: "Create, write or disable a public dashboard.",
			Group:       "Dashboards",
			Permissions: []ac.Permission{
				{Action: dashboards.ActionDashboardsPublicWrite, Scope: dashboards.ScopeDashboardsAll},
			},
		},
		Grants: []string{"Admin"},
	}

	return hs.accesscontrolService.DeclareFixedRoles(
		provisioningWriterRole, datasourcesReaderRole, builtInDatasourceReader, datasourcesWriterRole,
		datasourcesIdReaderRole, orgReaderRole, orgWriterRole,
		orgMaintainerRole, teamsCreatorRole, teamsWriterRole, datasourcesExplorerRole,
		annotationsReaderRole, dashboardAnnotationsWriterRole, annotationsWriterRole,
		dashboardsCreatorRole, dashboardsReaderRole, dashboardsWriterRole,
		foldersCreatorRole, foldersReaderRole, foldersWriterRole, apikeyReaderRole, apikeyWriterRole,
		publicDashboardsWriterRole,
	)
}

// Metadata helpers
// getAccessControlMetadata returns the accesscontrol metadata associated with a given resource
func (hs *HTTPServer) getAccessControlMetadata(c *contextmodel.ReqContext,
	orgID int64, prefix string, resourceID string) ac.Metadata {
	ids := map[string]bool{resourceID: true}
	return hs.getMultiAccessControlMetadata(c, orgID, prefix, ids)[resourceID]
}

// getMultiAccessControlMetadata returns the accesscontrol metadata associated with a given set of resources
// Context must contain permissions in the given org (see LoadPermissionsMiddleware or AuthorizeInOrgMiddleware)
func (hs *HTTPServer) getMultiAccessControlMetadata(c *contextmodel.ReqContext,
	orgID int64, prefix string, resourceIDs map[string]bool) map[string]ac.Metadata {
	if hs.AccessControl.IsDisabled() || !c.QueryBool("accesscontrol") {
		return map[string]ac.Metadata{}
	}

	if c.SignedInUser.Permissions == nil {
		return map[string]ac.Metadata{}
	}

	permissions, ok := c.SignedInUser.Permissions[orgID]
	if !ok {
		return map[string]ac.Metadata{}
	}

	return ac.GetResourcesMetadata(c.Req.Context(), permissions, prefix, resourceIDs)
}

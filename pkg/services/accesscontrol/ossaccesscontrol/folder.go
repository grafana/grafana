package ossaccesscontrol

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type FolderPermissionsService struct {
	*resourcepermissions.Service
}

var FolderViewActions = []string{dashboards.ActionFoldersRead, accesscontrol.ActionAlertingRuleRead, libraryelements.ActionLibraryPanelsRead, accesscontrol.ActionAlertingSilencesRead}
var FolderEditActions = append(FolderViewActions, []string{
	dashboards.ActionFoldersWrite,
	dashboards.ActionFoldersDelete,
	dashboards.ActionDashboardsCreate,
	accesscontrol.ActionAlertingRuleCreate,
	accesscontrol.ActionAlertingRuleUpdate,
	accesscontrol.ActionAlertingRuleDelete,
	accesscontrol.ActionAlertingSilencesCreate,
	accesscontrol.ActionAlertingSilencesWrite,
	libraryelements.ActionLibraryPanelsCreate,
	libraryelements.ActionLibraryPanelsWrite,
	libraryelements.ActionLibraryPanelsDelete,
}...)
var FolderAdminActions = append(FolderEditActions, []string{dashboards.ActionFoldersPermissionsRead, dashboards.ActionFoldersPermissionsWrite}...)

func registerFolderRoles(cfg *setting.Cfg, features featuremgmt.FeatureToggles, service accesscontrol.Service) error {
	if !cfg.RBAC.PermissionsWildcardSeed("folder") {
		return nil
	}

	viewer := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:folders:viewer",
			DisplayName: "Viewer",
			Description: "View all folders and dashboards.",
			Group:       "Folders",
			Permissions: accesscontrol.PermissionsForActions(append(getDashboardViewActions(features), FolderViewActions...), dashboards.ScopeFoldersAll),
			Hidden:      true,
		},
		Grants: []string{"Viewer"},
	}

	editor := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:folders:editor",
			DisplayName: "Editor",
			Description: "Edit all folders and dashboards.",
			Group:       "Folders",
			Permissions: accesscontrol.PermissionsForActions(append(getDashboardEditActions(features), FolderEditActions...), dashboards.ScopeFoldersAll),
			Hidden:      true,
		},
		Grants: []string{"Editor"},
	}

	admin := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:folders:admin",
			DisplayName: "Admin",
			Description: "Administer all folders and dashboards",
			Group:       "folders",
			Permissions: accesscontrol.PermissionsForActions(append(getDashboardAdminActions(features), FolderAdminActions...), dashboards.ScopeFoldersAll),
			Hidden:      true,
		},
		Grants: []string{"Admin"},
	}

	return service.DeclareFixedRoles(viewer, editor, admin)
}

func ProvideFolderPermissions(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, router routing.RouteRegister, sql db.DB, accesscontrol accesscontrol.AccessControl,
	license licensing.Licensing, dashboardStore dashboards.Store, folderStore folder.Store, service accesscontrol.Service,
	teamService team.Service, userService user.Service, actionSetService resourcepermissions.ActionSetService,
) (*FolderPermissionsService, error) {
	if err := registerFolderRoles(cfg, features, service); err != nil {
		return nil, err
	}

	options := resourcepermissions.Options{
		Resource:          "folders",
		ResourceAttribute: "uid",
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			ctx, span := tracer.Start(ctx, "accesscontrol.ossaccesscontrol.ProvideFolderPermissions.ResourceValidator")
			defer span.End()

			query := &dashboards.GetDashboardQuery{UID: resourceID, OrgID: orgID}
			queryResult, err := dashboardStore.GetDashboard(ctx, query)
			if err != nil {
				return err
			}

			if !queryResult.IsFolder {
				return errors.New("not found")
			}

			return nil
		},
		InheritedScopesSolver: func(ctx context.Context, orgID int64, resourceID string) ([]string, error) {
			return dashboards.GetInheritedScopes(ctx, orgID, resourceID, folderStore)
		},
		Assignments: resourcepermissions.Assignments{
			Users:           true,
			Teams:           true,
			BuiltInRoles:    true,
			ServiceAccounts: true,
		},
		PermissionsToActions: map[string][]string{
			"View":  append(getDashboardViewActions(features), FolderViewActions...),
			"Edit":  append(getDashboardEditActions(features), FolderEditActions...),
			"Admin": append(getDashboardAdminActions(features), FolderAdminActions...),
		},
		ReaderRoleName: "Folder permission reader",
		WriterRoleName: "Folder permission writer",
		RoleGroup:      "Folders",
	}
	srv, err := resourcepermissions.New(cfg, options, features, router, license, accesscontrol, service, sql, teamService, userService, actionSetService)
	if err != nil {
		return nil, err
	}
	return &FolderPermissionsService{srv}, nil
}

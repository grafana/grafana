package ossaccesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	license licensing.Licensing, folderService folder.Service, service accesscontrol.Service,
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

			ctx, ident := identity.WithServiceIdentity(ctx, orgID)
			_, err := folderService.Get(ctx, &folder.GetFolderQuery{
				UID:          &resourceID,
				OrgID:        orgID,
				SignedInUser: ident,
			})

			if err != nil {
				return err
			}

			return nil
		},
		InheritedScopesSolver: func(ctx context.Context, orgID int64, resourceID string) ([]string, error) {
			ctx, _ = identity.WithServiceIdentity(ctx, orgID)
			return dashboards.GetInheritedScopes(ctx, orgID, resourceID, folderService)
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
		ReaderRoleName: "Permission reader",
		WriterRoleName: "Permission writer",
		RoleGroup:      "Folders",
	}
	srv, err := resourcepermissions.New(cfg, options, features, router, license, accesscontrol, service, sql, teamService, userService, actionSetService)
	if err != nil {
		return nil, err
	}
	return &FolderPermissionsService{srv}, nil
}

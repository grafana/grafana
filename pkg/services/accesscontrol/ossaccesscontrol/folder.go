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

func ProvideFolderPermissions(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, router routing.RouteRegister, sql db.DB, accesscontrol accesscontrol.AccessControl,
	license licensing.Licensing, dashboardStore dashboards.Store, folderService folder.Service, service accesscontrol.Service,
	teamService team.Service, userService user.Service, actionSetService resourcepermissions.ActionSetService,
) (*FolderPermissionsService, error) {
	options := resourcepermissions.Options{
		Resource:          "folders",
		ResourceAttribute: "uid",
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
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

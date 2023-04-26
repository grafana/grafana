package ossaccesscontrol

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/retriever"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type TeamPermissionsService struct {
	*resourcepermissions.Service
}

var (
	TeamMemberActions = []string{
		accesscontrol.ActionTeamsRead,
	}

	TeamAdminActions = []string{
		accesscontrol.ActionTeamsRead,
		accesscontrol.ActionTeamsDelete,
		accesscontrol.ActionTeamsWrite,
		accesscontrol.ActionTeamsPermissionsRead,
		accesscontrol.ActionTeamsPermissionsWrite,
	}
)

func ProvideTeamPermissions(
	cfg *setting.Cfg, router routing.RouteRegister, sql db.DB,
	ac accesscontrol.AccessControl, license licensing.Licensing, service accesscontrol.Service,
	teamService team.Service, userService user.Service,
) (*TeamPermissionsService, error) {
	options := resourcepermissions.Options{
		Resource:          "teams",
		ResourceAttribute: "id",
		OnlyManaged:       true,
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			id, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}

			_, err = teamService.GetTeamByID(context.Background(), &team.GetTeamByIDQuery{
				OrgID: orgID,
				ID:    id,
			})
			if err != nil {
				return err
			}

			return nil
		},
		Assignments: resourcepermissions.Assignments{
			Users:        true,
			Teams:        false,
			BuiltInRoles: false,
		},
		PermissionsToActions: map[string][]string{
			"Member": TeamMemberActions,
			"Admin":  TeamAdminActions,
		},
		ReaderRoleName: "Team permission reader",
		WriterRoleName: "Team permission writer",
		RoleGroup:      "Teams",
		OnSetUser: func(session *db.Session, orgID int64, user accesscontrol.User, resourceID, permission string) error {
			teamId, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			switch permission {
			case "Member":
				return teamimpl.AddOrUpdateTeamMemberHook(session, user.ID, orgID, teamId, user.IsExternal, 0)
			case "Admin":
				return teamimpl.AddOrUpdateTeamMemberHook(session, user.ID, orgID, teamId, user.IsExternal, dashboards.PERMISSION_ADMIN)
			case "":
				return teamimpl.RemoveTeamMemberHook(session, &team.RemoveTeamMemberCommand{
					OrgID:  orgID,
					UserID: user.ID,
					TeamID: teamId,
				})
			default:
				return fmt.Errorf("invalid team permission type %s", permission)
			}
		},
	}

	srv, err := resourcepermissions.New(options, cfg, router, license, ac, service, sql, teamService, userService)
	if err != nil {
		return nil, err
	}
	return &TeamPermissionsService{srv}, nil
}

type DashboardPermissionsService struct {
	*resourcepermissions.Service
}

var DashboardViewActions = []string{dashboards.ActionDashboardsRead}
var DashboardEditActions = append(DashboardViewActions, []string{dashboards.ActionDashboardsWrite, dashboards.ActionDashboardsDelete}...)
var DashboardAdminActions = append(DashboardEditActions, []string{dashboards.ActionDashboardsPermissionsRead, dashboards.ActionDashboardsPermissionsWrite}...)

func ProvideDashboardPermissions(
	cfg *setting.Cfg, router routing.RouteRegister, sql db.DB, ac accesscontrol.AccessControl,
	license licensing.Licensing, dashboardStore dashboards.Store, folderService folder.Service, service accesscontrol.Service,
	teamService team.Service, userService user.Service,
) (*DashboardPermissionsService, error) {
	getDashboard := func(ctx context.Context, orgID int64, resourceID string) (*dashboards.Dashboard, error) {
		query := &dashboards.GetDashboardQuery{UID: resourceID, OrgID: orgID}
		queryResult, err := dashboardStore.GetDashboard(ctx, query)
		if err != nil {
			return nil, err
		}
		return queryResult, nil
	}

	options := resourcepermissions.Options{
		Resource:          "dashboards",
		ResourceAttribute: "uid",
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			dashboard, err := getDashboard(ctx, orgID, resourceID)
			if err != nil {
				return err
			}

			if dashboard.IsFolder {
				return errors.New("not found")
			}

			return nil
		},
		InheritedScopesSolver: func(ctx context.Context, orgID int64, resourceID string) ([]string, error) {
			dashboard, err := getDashboard(ctx, orgID, resourceID)
			if err != nil {
				return nil, err
			}
			if dashboard.FolderID > 0 {
				query := &dashboards.GetDashboardQuery{ID: dashboard.FolderID, OrgID: orgID}
				queryResult, err := dashboardStore.GetDashboard(ctx, query)
				if err != nil {
					return nil, err
				}
				parentScope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(queryResult.UID)

				nestedScopes, err := dashboards.GetInheritedScopes(ctx, orgID, queryResult.UID, folderService)
				if err != nil {
					return nil, err
				}
				return append([]string{parentScope}, nestedScopes...), nil
			}
			return []string{}, nil
		},
		Assignments: resourcepermissions.Assignments{
			Users:        true,
			Teams:        true,
			BuiltInRoles: true,
		},
		PermissionsToActions: map[string][]string{
			"View":  DashboardViewActions,
			"Edit":  DashboardEditActions,
			"Admin": DashboardAdminActions,
		},
		ReaderRoleName: "Dashboard permission reader",
		WriterRoleName: "Dashboard permission writer",
		RoleGroup:      "Dashboards",
	}

	srv, err := resourcepermissions.New(options, cfg, router, license, ac, service, sql, teamService, userService)
	if err != nil {
		return nil, err
	}
	return &DashboardPermissionsService{srv}, nil
}

type FolderPermissionsService struct {
	*resourcepermissions.Service
}

var FolderViewActions = []string{dashboards.ActionFoldersRead, accesscontrol.ActionAlertingRuleRead}
var FolderEditActions = append(FolderViewActions, []string{
	dashboards.ActionFoldersWrite,
	dashboards.ActionFoldersDelete,
	dashboards.ActionDashboardsCreate,
	accesscontrol.ActionAlertingRuleCreate,
	accesscontrol.ActionAlertingRuleUpdate,
	accesscontrol.ActionAlertingRuleDelete,
}...)
var FolderAdminActions = append(FolderEditActions, []string{dashboards.ActionFoldersPermissionsRead, dashboards.ActionFoldersPermissionsWrite}...)

func ProvideFolderPermissions(
	cfg *setting.Cfg, router routing.RouteRegister, sql db.DB, accesscontrol accesscontrol.AccessControl,
	license licensing.Licensing, dashboardStore dashboards.Store, folderService folder.Service, service accesscontrol.Service,
	teamService team.Service, userService user.Service,
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
			Users:        true,
			Teams:        true,
			BuiltInRoles: true,
		},
		PermissionsToActions: map[string][]string{
			"View":  append(DashboardViewActions, FolderViewActions...),
			"Edit":  append(DashboardEditActions, FolderEditActions...),
			"Admin": append(DashboardAdminActions, FolderAdminActions...),
		},
		ReaderRoleName: "Folder permission reader",
		WriterRoleName: "Folder permission writer",
		RoleGroup:      "Folders",
	}
	srv, err := resourcepermissions.New(options, cfg, router, license, accesscontrol, service, sql, teamService, userService)
	if err != nil {
		return nil, err
	}
	return &FolderPermissionsService{srv}, nil
}

func ProvideDatasourcePermissionsService() *DatasourcePermissionsService {
	return &DatasourcePermissionsService{}
}

var _ accesscontrol.DatasourcePermissionsService = new(DatasourcePermissionsService)

type DatasourcePermissionsService struct{}

func (e DatasourcePermissionsService) GetPermissions(ctx context.Context, user *user.SignedInUser, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e DatasourcePermissionsService) SetUserPermission(ctx context.Context, orgID int64, user accesscontrol.User, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e DatasourcePermissionsService) SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e DatasourcePermissionsService) SetBuiltInRolePermission(ctx context.Context, orgID int64, builtInRole string, resourceID string, permission string) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e DatasourcePermissionsService) SetPermissions(ctx context.Context, orgID int64, resourceID string, commands ...accesscontrol.SetResourcePermissionCommand) ([]accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e DatasourcePermissionsService) MapActions(permission accesscontrol.ResourcePermission) string {
	return ""
}

var (
	ServiceAccountEditActions = []string{
		serviceaccounts.ActionRead,
		serviceaccounts.ActionWrite,
	}
	ServiceAccountAdminActions = []string{
		serviceaccounts.ActionRead,
		serviceaccounts.ActionWrite,
		serviceaccounts.ActionDelete,
		serviceaccounts.ActionPermissionsRead,
		serviceaccounts.ActionPermissionsWrite,
	}
)

type ServiceAccountPermissionsService struct {
	*resourcepermissions.Service
}

func ProvideServiceAccountPermissions(
	cfg *setting.Cfg, router routing.RouteRegister, sql db.DB, ac accesscontrol.AccessControl,
	license licensing.Licensing, serviceAccountRetrieverService *retriever.Service, service accesscontrol.Service,
	teamService team.Service, userService user.Service,
) (*ServiceAccountPermissionsService, error) {
	options := resourcepermissions.Options{
		Resource:          "serviceaccounts",
		ResourceAttribute: "id",
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			id, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			_, err = serviceAccountRetrieverService.RetrieveServiceAccount(ctx, orgID, id)
			return err
		},
		Assignments: resourcepermissions.Assignments{
			Users:        true,
			Teams:        true,
			BuiltInRoles: false,
		},
		PermissionsToActions: map[string][]string{
			"Edit":  ServiceAccountEditActions,
			"Admin": ServiceAccountAdminActions,
		},
		ReaderRoleName: "Service account permission reader",
		WriterRoleName: "Service account permission writer",
		RoleGroup:      "Service accounts",
	}

	srv, err := resourcepermissions.New(options, cfg, router, license, ac, service, sql, teamService, userService)
	if err != nil {
		return nil, err
	}
	return &ServiceAccountPermissionsService{srv}, nil
}

package ossaccesscontrol

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvidePermissionsServices(
	cfg *setting.Cfg, router routing.RouteRegister, sql *sqlstore.SQLStore,
	ac accesscontrol.AccessControl, store resourcepermissions.Store,
) (*PermissionsServices, error) {
	teamPermissions, err := ProvideTeamPermissions(cfg, router, sql, ac, store)
	if err != nil {
		return nil, err
	}
	folderPermissions, err := ProvideFolderPermissions(cfg, router, sql, ac, store)
	if err != nil {
		return nil, err
	}
	dashboardPermissions, err := ProvideDashboardPermissions(cfg, router, sql, ac, store)
	if err != nil {
		return nil, err
	}

	return &PermissionsServices{
		teams:       teamPermissions,
		folder:      folderPermissions,
		dashboard:   dashboardPermissions,
		datasources: provideEmptyPermissionsService(),
	}, nil
}

type PermissionsServices struct {
	teams       accesscontrol.PermissionsService
	folder      accesscontrol.PermissionsService
	dashboard   accesscontrol.PermissionsService
	datasources accesscontrol.PermissionsService
}

func (s *PermissionsServices) GetTeamService() accesscontrol.PermissionsService {
	return s.teams
}

func (s *PermissionsServices) GetFolderService() accesscontrol.PermissionsService {
	return s.folder
}

func (s *PermissionsServices) GetDashboardService() accesscontrol.PermissionsService {
	return s.dashboard
}

func (s *PermissionsServices) GetDataSourceService() accesscontrol.PermissionsService {
	return s.datasources
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
	cfg *setting.Cfg, router routing.RouteRegister, sql *sqlstore.SQLStore,
	ac accesscontrol.AccessControl, store resourcepermissions.Store,
) (*resourcepermissions.Service, error) {
	options := resourcepermissions.Options{
		Resource:          "teams",
		ResourceAttribute: "id",
		OnlyManaged:       true,
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			id, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}

			err = sql.GetTeamById(context.Background(), &models.GetTeamByIdQuery{
				OrgId: orgID,
				Id:    id,
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
		OnSetUser: func(session *sqlstore.DBSession, orgID int64, user accesscontrol.User, resourceID, permission string) error {
			teamId, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			switch permission {
			case "Member":
				return sqlstore.AddOrUpdateTeamMemberHook(session, user.ID, orgID, teamId, user.IsExternal, 0)
			case "Admin":
				return sqlstore.AddOrUpdateTeamMemberHook(session, user.ID, orgID, teamId, user.IsExternal, models.PERMISSION_ADMIN)
			case "":
				return sqlstore.RemoveTeamMemberHook(session, &models.RemoveTeamMemberCommand{
					OrgId:  orgID,
					UserId: user.ID,
					TeamId: teamId,
				})
			default:
				return fmt.Errorf("invalid team permission type %s", permission)
			}
		},
	}

	return resourcepermissions.New(options, cfg, router, ac, store, sql)
}

var DashboardViewActions = []string{accesscontrol.ActionDashboardsRead}
var DashboardEditActions = append(DashboardViewActions, []string{accesscontrol.ActionDashboardsWrite, accesscontrol.ActionDashboardsDelete}...)
var DashboardAdminActions = append(DashboardEditActions, []string{accesscontrol.ActionDashboardsPermissionsRead, accesscontrol.ActionDashboardsPermissionsWrite}...)

func ProvideDashboardPermissions(
	cfg *setting.Cfg, router routing.RouteRegister, sql *sqlstore.SQLStore,
	ac accesscontrol.AccessControl, store resourcepermissions.Store,
) (*resourcepermissions.Service, error) {
	getDashboard := func(ctx context.Context, orgID int64, resourceID string) (*models.Dashboard, error) {
		query := &models.GetDashboardQuery{Uid: resourceID, OrgId: orgID}
		if err := sql.GetDashboard(ctx, query); err != nil {
			return nil, err
		}
		return query.Result, nil
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
		InheritedScopePrefixes: []string{"folders:uid:"},
		InheritedScopesSolver: func(ctx context.Context, orgID int64, resourceID string) ([]string, error) {
			dashboard, err := getDashboard(ctx, orgID, resourceID)
			if err != nil {
				return nil, err
			}
			if dashboard.FolderId > 0 {
				query := &models.GetDashboardQuery{Id: dashboard.FolderId, OrgId: orgID}
				if err := sql.GetDashboard(ctx, query); err != nil {
					return nil, err
				}
				return []string{dashboards.ScopeFoldersProvider.GetResourceScopeUID(query.Result.Uid)}, nil
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

	return resourcepermissions.New(options, cfg, router, ac, store, sql)
}

var FolderViewActions = []string{dashboards.ActionFoldersRead}
var FolderEditActions = append(FolderViewActions, []string{dashboards.ActionFoldersWrite, dashboards.ActionFoldersDelete, accesscontrol.ActionDashboardsCreate}...)
var FolderAdminActions = append(FolderEditActions, []string{dashboards.ActionFoldersPermissionsRead, dashboards.ActionFoldersPermissionsWrite}...)

func ProvideFolderPermissions(
	cfg *setting.Cfg, router routing.RouteRegister, sql *sqlstore.SQLStore,
	accesscontrol accesscontrol.AccessControl, store resourcepermissions.Store,
) (*resourcepermissions.Service, error) {
	options := resourcepermissions.Options{
		Resource:          "folders",
		ResourceAttribute: "uid",
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			query := &models.GetDashboardQuery{Uid: resourceID, OrgId: orgID}
			if err := sql.GetDashboard(ctx, query); err != nil {
				return err
			}

			if !query.Result.IsFolder {
				return errors.New("not found")
			}

			return nil
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

	return resourcepermissions.New(options, cfg, router, accesscontrol, store, sql)
}

func provideEmptyPermissionsService() accesscontrol.PermissionsService {
	return &emptyPermissionsService{}
}

var _ accesscontrol.PermissionsService = new(emptyPermissionsService)

type emptyPermissionsService struct{}

func (e emptyPermissionsService) GetPermissions(ctx context.Context, user *models.SignedInUser, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e emptyPermissionsService) SetUserPermission(ctx context.Context, orgID int64, user accesscontrol.User, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e emptyPermissionsService) SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e emptyPermissionsService) SetBuiltInRolePermission(ctx context.Context, orgID int64, builtInRole string, resourceID string, permission string) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e emptyPermissionsService) SetPermissions(ctx context.Context, orgID int64, resourceID string, commands ...accesscontrol.SetResourcePermissionCommand) ([]accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e emptyPermissionsService) MapActions(permission accesscontrol.ResourcePermission) string {
	return ""
}

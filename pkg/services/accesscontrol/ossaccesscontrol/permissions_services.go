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
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvidePermissionsServices(router routing.RouteRegister, sql *sqlstore.SQLStore, ac accesscontrol.AccessControl, store resourcepermissions.Store) (*PermissionsServices, error) {
	teamPermissions, err := ProvideTeamPermissions(router, sql, ac, store)
	if err != nil {
		return nil, err
	}
	folderPermissions, err := provideFolderService(router, sql, ac, store)
	if err != nil {
		return nil, err
	}
	dashboardPermissions, err := provideDashboardService(router, sql, ac, store)
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

func ProvideTeamPermissions(router routing.RouteRegister, sql *sqlstore.SQLStore, ac accesscontrol.AccessControl, store resourcepermissions.Store) (*resourcepermissions.Service, error) {
	options := resourcepermissions.Options{
		Resource:    "teams",
		OnlyManaged: true,
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

	return resourcepermissions.New(options, router, ac, store, sql)
}

var DashboardViewActions = []string{accesscontrol.ActionDashboardsRead}
var DashboardEditActions = append(DashboardViewActions, []string{accesscontrol.ActionDashboardsWrite, accesscontrol.ActionDashboardsDelete}...)
var DashboardAdminActions = append(DashboardEditActions, []string{accesscontrol.ActionDashboardsPermissionsRead, accesscontrol.ActionDashboardsPermissionsWrite}...)
var FolderViewActions = []string{accesscontrol.ActionFoldersRead}
var FolderEditActions = append(FolderViewActions, []string{accesscontrol.ActionFoldersWrite, accesscontrol.ActionFoldersDelete, accesscontrol.ActionDashboardsCreate}...)
var FolderAdminActions = append(FolderEditActions, []string{accesscontrol.ActionFoldersPermissionsRead, accesscontrol.ActionFoldersPermissionsWrite}...)

func provideDashboardService(router routing.RouteRegister, sql *sqlstore.SQLStore, accesscontrol accesscontrol.AccessControl, store resourcepermissions.Store) (*resourcepermissions.Service, error) {
	options := resourcepermissions.Options{
		Resource: "dashboards",
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			id, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			query := &models.GetDashboardQuery{Id: id, OrgId: orgID}
			if err := sql.GetDashboard(ctx, query); err != nil {
				return err
			}

			if query.Result.IsFolder {
				return errors.New("not found")
			}

			return nil
		},
		UidSolver: func(ctx context.Context, orgID int64, uid string) (int64, error) {
			query := &models.GetDashboardQuery{
				Uid:   uid,
				OrgId: orgID,
			}
			if err := sql.GetDashboard(ctx, query); err != nil {
				return 0, err
			}
			return query.Result.Id, nil
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

	return resourcepermissions.New(options, router, accesscontrol, store, sql)
}

func provideFolderService(router routing.RouteRegister, sql *sqlstore.SQLStore, accesscontrol accesscontrol.AccessControl, store resourcepermissions.Store) (*resourcepermissions.Service, error) {
	options := resourcepermissions.Options{
		Resource: "folders",
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			id, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			query := &models.GetDashboardQuery{Id: id, OrgId: orgID}
			if err := sql.GetDashboard(ctx, query); err != nil {
				return err
			}

			if !query.Result.IsFolder {
				return errors.New("not found")
			}

			return nil
		},
		UidSolver: func(ctx context.Context, orgID int64, uid string) (int64, error) {
			query := &models.GetDashboardQuery{
				Uid:   uid,
				OrgId: orgID,
			}
			if err := sql.GetDashboard(ctx, query); err != nil {
				return 0, err
			}
			return query.Result.Id, nil
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

	return resourcepermissions.New(options, router, accesscontrol, store, sql)
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

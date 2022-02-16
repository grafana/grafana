package resourceservices

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

func ProvideResourceServices(router routing.RouteRegister, sql *sqlstore.SQLStore, ac accesscontrol.AccessControl, store resourcepermissions.Store) (*ResourceServices, error) {
	teamPermissions, err := ProvideTeamPermissions(router, sql, ac, store)
	if err != nil {
		return nil, err
	}

	dashboardsService, err := provideDashboardService(sql, router, ac, store)
	if err != nil {
		return nil, err
	}

	folderService, err := provideFolderService(sql, router, ac, store)
	if err != nil {
		return nil, err
	}

	return &ResourceServices{services: map[string]*resourcepermissions.Service{
		"teams":      teamPermissions,
		"folders":    folderService,
		"dashboards": dashboardsService,
	}}, nil
}

type ResourceServices struct {
	services map[string]*resourcepermissions.Service
}

func (s *ResourceServices) GetTeamService() *resourcepermissions.Service {
	return s.services["teams"]
}

func (s *ResourceServices) GetDashboardService() *resourcepermissions.Service {
	return s.services["dashboards"]
}

func (s *ResourceServices) GetFolderService() *resourcepermissions.Service {
	return s.services["folders"]
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

var dashboardsView = []string{accesscontrol.ActionDashboardsRead}
var dashboardsEdit = append(dashboardsView, []string{accesscontrol.ActionDashboardsWrite, accesscontrol.ActionDashboardsDelete, accesscontrol.ActionDashboardsEdit}...)
var dashboardsAdmin = append(dashboardsEdit, []string{accesscontrol.ActionDashboardsPermissionsRead, accesscontrol.ActionDashboardsPermissionsWrite}...)
var foldersView = []string{accesscontrol.ActionFoldersRead}
var foldersEdit = append(foldersView, []string{accesscontrol.ActionFoldersWrite, accesscontrol.ActionFoldersDelete, accesscontrol.ActionFoldersEdit, accesscontrol.ActionDashboardsCreate}...)
var foldersAdmin = append(foldersEdit, []string{accesscontrol.ActionFoldersPermissionsRead, accesscontrol.ActionFoldersPermissionsWrite}...)

func provideDashboardService(sql *sqlstore.SQLStore, router routing.RouteRegister, accesscontrol accesscontrol.AccessControl, store resourcepermissions.Store) (*resourcepermissions.Service, error) {
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
			"View":  dashboardsView,
			"Edit":  dashboardsEdit,
			"Admin": dashboardsAdmin,
		},
		ReaderRoleName: "Dashboard permission reader",
		WriterRoleName: "Dashboard permission writer",
		RoleGroup:      "Dashboards",
	}

	return resourcepermissions.New(options, router, accesscontrol, store, sql)
}

func provideFolderService(sql *sqlstore.SQLStore, router routing.RouteRegister, accesscontrol accesscontrol.AccessControl, store resourcepermissions.Store) (*resourcepermissions.Service, error) {
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
			"View":  append(dashboardsView, foldersView...),
			"Edit":  append(dashboardsEdit, foldersEdit...),
			"Admin": append(dashboardsAdmin, foldersAdmin...),
		},
		ReaderRoleName: "Folder permission reader",
		WriterRoleName: "Folder permission writer",
		RoleGroup:      "Folders",
	}

	return resourcepermissions.New(options, router, accesscontrol, store, sql)
}

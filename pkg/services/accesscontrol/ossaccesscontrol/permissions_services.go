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
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
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
	cfg *setting.Cfg, router routing.RouteRegister, sql *sqlstore.SQLStore,
	ac accesscontrol.AccessControl, license models.Licensing, service accesscontrol.Service,
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

	srv, err := resourcepermissions.New(options, cfg, router, license, ac, service, sql)
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
	cfg *setting.Cfg, router routing.RouteRegister, sql *sqlstore.SQLStore, ac accesscontrol.AccessControl,
	license models.Licensing, dashboardStore dashboards.Store, service accesscontrol.Service,
) (*DashboardPermissionsService, error) {
	getDashboard := func(ctx context.Context, orgID int64, resourceID string) (*models.Dashboard, error) {
		query := &models.GetDashboardQuery{Uid: resourceID, OrgId: orgID}
		if _, err := dashboardStore.GetDashboard(ctx, query); err != nil {
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
		InheritedScopesSolver: func(ctx context.Context, orgID int64, resourceID string) ([]string, error) {
			dashboard, err := getDashboard(ctx, orgID, resourceID)
			if err != nil {
				return nil, err
			}
			if dashboard.FolderId > 0 {
				query := &models.GetDashboardQuery{Id: dashboard.FolderId, OrgId: orgID}
				if _, err := dashboardStore.GetDashboard(ctx, query); err != nil {
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

	srv, err := resourcepermissions.New(options, cfg, router, license, ac, service, sql)
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
	cfg *setting.Cfg, router routing.RouteRegister, sql *sqlstore.SQLStore, accesscontrol accesscontrol.AccessControl,
	license models.Licensing, dashboardStore dashboards.Store, service accesscontrol.Service,
) (*FolderPermissionsService, error) {
	options := resourcepermissions.Options{
		Resource:          "folders",
		ResourceAttribute: "uid",
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			query := &models.GetDashboardQuery{Uid: resourceID, OrgId: orgID}
			if _, err := dashboardStore.GetDashboard(ctx, query); err != nil {
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
	srv, err := resourcepermissions.New(options, cfg, router, license, accesscontrol, service, sql)
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
	cfg *setting.Cfg, router routing.RouteRegister, sql *sqlstore.SQLStore, ac accesscontrol.AccessControl,
	license models.Licensing, serviceAccountStore serviceaccounts.Store, service accesscontrol.Service,
) (*ServiceAccountPermissionsService, error) {
	options := resourcepermissions.Options{
		Resource:          "serviceaccounts",
		ResourceAttribute: "id",
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			id, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			_, err = serviceAccountStore.RetrieveServiceAccount(ctx, orgID, id)
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

	srv, err := resourcepermissions.New(options, cfg, router, license, ac, service, sql)
	if err != nil {
		return nil, err
	}
	return &ServiceAccountPermissionsService{srv}, nil
}

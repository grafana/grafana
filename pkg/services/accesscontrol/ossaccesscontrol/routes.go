package ossaccesscontrol

import (
	"context"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var RoutesViewActions = []string{accesscontrol.ActionAlertingManagedRoutesRead}
var RoutesEditActions = append(RoutesViewActions, []string{
	accesscontrol.ActionAlertingManagedRoutesWrite,
	accesscontrol.ActionAlertingManagedRoutesDelete,
}...)
var RoutesAdminActions = append(RoutesEditActions, []string{
	accesscontrol.ActionAlertingRoutesPermissionsRead,
	accesscontrol.ActionAlertingRoutesPermissionsWrite,
}...)

// routeDefaultPermissions returns the default permissions for a newly created route.
func routeDefaultPermissions() []accesscontrol.SetResourcePermissionCommand {
	return []accesscontrol.SetResourcePermissionCommand{
		{BuiltinRole: string(org.RoleEditor), Permission: string(models.PermissionEdit)},
		{BuiltinRole: string(org.RoleViewer), Permission: string(models.PermissionView)},
	}
}

func ProvideRoutePermissionsService(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, router routing.RouteRegister, sql db.DB, ac accesscontrol.AccessControl,
	license licensing.Licensing, service accesscontrol.Service,
	teamService team.Service, userService user.Service, actionSetService resourcepermissions.ActionSetService,
) (*RoutePermissionsService, error) {
	options := resourcepermissions.Options{
		Resource:          "routes",
		ResourceAttribute: "uid",
		ResourceTranslator: func(ctx context.Context, orgID int64, resourceID string) (string, error) {
			return resourceID, nil
		},
		Assignments: resourcepermissions.Assignments{
			Users:           true,
			Teams:           true,
			BuiltInRoles:    true,
			ServiceAccounts: true,
		},
		PermissionsToActions: map[string][]string{
			string(models.PermissionView):  append([]string{}, RoutesViewActions...),
			string(models.PermissionEdit):  append([]string{}, RoutesEditActions...),
			string(models.PermissionAdmin): append([]string{}, RoutesAdminActions...),
		},
		ReaderRoleName: "Alerting route permission reader",
		WriterRoleName: "Alerting route permission writer",
		RoleGroup:      models.AlertRolesGroup,
	}

	srv, err := resourcepermissions.New(cfg, options, features, router, license, ac, service, sql, teamService, userService, actionSetService)
	if err != nil {
		return nil, err
	}
	return &RoutePermissionsService{Service: srv, ac: service, log: log.New("resourcepermissions.routes")}, nil
}

var _ accesscontrol.RoutePermissionsService = new(RoutePermissionsService)

type RoutePermissionsService struct {
	*resourcepermissions.Service
	ac  accesscontrol.Service
	log log.Logger
}

// SetDefaultPermissions sets the default permissions for a newly created route.
// Built-in routes are granted respective permissions, and the current user gets admin permissions.
func (r RoutePermissionsService) SetDefaultPermissions(ctx context.Context, orgID int64, user identity.Requester, name string) error {
	r.log.Debug("Setting default permissions for route", "route_name", name)
	permissions := routeDefaultPermissions()
	clearCache := false
	if user != nil && user.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		userID, err := user.GetInternalID()
		if err != nil {
			r.log.Error("Could not make user admin", "route_name", name, "id", user.GetID(), "error", err)
		} else {
			permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
				UserID: userID, Permission: string(models.PermissionAdmin),
			})
			clearCache = true
		}
	}
	if _, err := r.SetPermissions(ctx, orgID, name, permissions...); err != nil {
		return err
	}
	if clearCache {
		r.ac.ClearUserPermissionCache(user)
	}
	return nil
}

func (r RoutePermissionsService) DeleteResourcePermissions(ctx context.Context, orgID int64, name string) error {
	return r.Service.DeleteResourcePermissions(ctx, orgID, name)
}

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

type ResourcePermission = string

const (
	PermissionView  ResourcePermission = "View"
	PermissionEdit  ResourcePermission = "Edit"
	PermissionAdmin ResourcePermission = "Admin"
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
		{BuiltinRole: string(org.RoleEditor), Permission: PermissionEdit},
		{BuiltinRole: string(org.RoleViewer), Permission: PermissionView},
	}
}

func ProvideRoutePermissionsService(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, router routing.RouteRegister, sql db.DB, ac accesscontrol.AccessControl,
	license licensing.Licensing, service accesscontrol.Service,
	teamService team.Service, userService user.Service, actionSetService resourcepermissions.ActionSetService,
) (*RoutePermissionsService, error) {
	options := resourcepermissions.Options{
		APIGroup:          accesscontrol.AlertingNotificationsApiGroup,
		Resource:          accesscontrol.AlertingRoutesResource,
		ResourceAttribute: "uid",
		ResourceTranslator: func(ctx context.Context, orgID int64, resourceID string) (string, error) {
			return resourceID, nil
		},
		K8sActionFormat: true,
		Assignments: resourcepermissions.Assignments{
			Users:           true,
			Teams:           true,
			BuiltInRoles:    true,
			ServiceAccounts: true,
		},
		PermissionsToActions: map[string][]string{
			PermissionView:  append([]string{}, RoutesViewActions...),
			PermissionEdit:  append([]string{}, RoutesEditActions...),
			PermissionAdmin: append([]string{}, RoutesAdminActions...),
		},
		ReaderRoleName: "Alerting route permission reader",
		WriterRoleName: "Alerting route permission writer",
		RoleGroup:      models.AlertRolesGroup,
	}

	srv, err := resourcepermissions.New(cfg, options, features, router, license, ac, service, sql, teamService, userService, actionSetService)
	if err != nil {
		return nil, err
	}
	return &RoutePermissionsService{Service: srv, ac: service, log: log.New("resourcepermissions." + accesscontrol.AlertingRoutesResource)}, nil
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
				UserID: userID, Permission: PermissionAdmin,
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

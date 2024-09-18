package ossaccesscontrol

import (
	"context"

	"github.com/grafana/authlib/claims"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/ngalert"
	alertingac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var ReceiversViewActions = []string{accesscontrol.ActionAlertingReceiversRead}
var ReceiversEditActions = append(ReceiversViewActions, []string{accesscontrol.ActionAlertingReceiversUpdate, accesscontrol.ActionAlertingReceiversDelete}...)
var ReceiversAdminActions = append(ReceiversEditActions, []string{accesscontrol.ActionAlertingReceiversReadSecrets, accesscontrol.ActionAlertingReceiversPermissionsRead, accesscontrol.ActionAlertingReceiversPermissionsWrite}...)

func defaultPermissions() []accesscontrol.SetResourcePermissionCommand {
	return []accesscontrol.SetResourcePermissionCommand{
		{BuiltinRole: string(org.RoleEditor), Permission: string(alertingac.ReceiverPermissionEdit)},
		{BuiltinRole: string(org.RoleViewer), Permission: string(alertingac.ReceiverPermissionView)},
	}
}

func registerReceiverRoles(cfg *setting.Cfg, service accesscontrol.Service) error {
	if !cfg.RBAC.PermissionsWildcardSeed("receiver") { // TODO: Do we need wildcard seed support in alerting?
		return nil
	}

	viewer := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:receivers:viewer",
			DisplayName: "Viewer",
			Description: "View all receivers",
			Group:       ngalert.AlertRolesGroup,
			Permissions: accesscontrol.PermissionsForActions(ReceiversViewActions, alertingac.ScopeReceiversAll),
			Hidden:      true,
		},
		Grants: []string{string(org.RoleViewer)},
	}

	editor := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:receivers:editor",
			DisplayName: "Editor",
			Description: "Edit all receivers.",
			Group:       ngalert.AlertRolesGroup,
			Permissions: accesscontrol.PermissionsForActions(ReceiversEditActions, alertingac.ScopeReceiversAll),
			Hidden:      true,
		},
		Grants: []string{string(org.RoleEditor)},
	}

	admin := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:receivers:admin",
			DisplayName: "Admin",
			Description: "Administer all receivers (reads secrets).",
			Group:       ngalert.AlertRolesGroup,
			Permissions: accesscontrol.PermissionsForActions(ReceiversAdminActions, alertingac.ScopeReceiversAll),
			Hidden:      true,
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	return service.DeclareFixedRoles(viewer, editor, admin)
}

func ProvideReceiverPermissionsService(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, router routing.RouteRegister, sql db.DB, ac accesscontrol.AccessControl,
	license licensing.Licensing, service accesscontrol.Service,
	teamService team.Service, userService user.Service, actionSetService resourcepermissions.ActionSetService,
) (*ReceiverPermissionsService, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAlertingApiServer) {
		return nil, nil
	}
	if err := registerReceiverRoles(cfg, service); err != nil {
		return nil, err
	}

	options := resourcepermissions.Options{
		Resource:          "receivers",
		ResourceAttribute: "uid",
		Assignments: resourcepermissions.Assignments{
			Users:           true,
			Teams:           true,
			BuiltInRoles:    true,
			ServiceAccounts: true,
		},
		PermissionsToActions: map[string][]string{
			string(alertingac.ReceiverPermissionView):  append([]string{}, ReceiversViewActions...),
			string(alertingac.ReceiverPermissionEdit):  append([]string{}, ReceiversEditActions...),
			string(alertingac.ReceiverPermissionAdmin): append([]string{}, ReceiversAdminActions...),
		},
		ReaderRoleName: "Alerting receiver permission reader",
		WriterRoleName: "Alerting receiver permission writer",
		RoleGroup:      ngalert.AlertRolesGroup,
	}

	srv, err := resourcepermissions.New(cfg, options, features, router, license, ac, service, sql, teamService, userService, actionSetService)
	if err != nil {
		return nil, err
	}
	return &ReceiverPermissionsService{srv, service, log.New("resourcepermissions.receivers")}, nil
}

var _ accesscontrol.ReceiverPermissionsService = new(ReceiverPermissionsService)

type ReceiverPermissionsService struct {
	*resourcepermissions.Service
	ac  accesscontrol.Service
	log log.Logger
}

func (r ReceiverPermissionsService) SetDefaultPermissions(ctx context.Context, orgID int64, user identity.Requester, uid string) {
	// TODO: Do we need support for cfg.RBAC.PermissionsOnCreation?

	permissions := defaultPermissions()
	clearCache := false
	if user != nil && user.IsIdentityType(claims.TypeUser) {
		userID, err := user.GetInternalID()
		if err != nil {
			r.log.Error("Could not make user admin", "receiver_uid", uid, "id", user.GetID(), "error", err)
		} else {
			permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
				UserID: userID, Permission: string(alertingac.ReceiverPermissionAdmin),
			})
			clearCache = true
		}
	}

	if _, err := r.SetPermissions(ctx, orgID, uid, permissions...); err != nil {
		r.log.Error("Could not set default permissions", "receiver_uid", uid, "error", err)
	}

	if clearCache {
		// Clear permission cache for the user who created the receiver, so that new permissions are fetched for their next call
		// Required for cases when caller wants to immediately interact with the newly created object
		r.ac.ClearUserPermissionCache(user)
	}
}

func copyPermissionUser(orgID int64) identity.Requester {
	return accesscontrol.BackgroundUser("receiver_access_service", orgID, org.RoleAdmin, accesscontrol.ConcatPermissions(
		accesscontrol.PermissionsForActions(ReceiversAdminActions, alertingac.ScopeReceiversAll),
		[]accesscontrol.Permission{ // Permissions needed for GetPermissions to return user, service account, and team permissions.
			{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
			{Action: serviceaccounts.ActionRead, Scope: serviceaccounts.ScopeAll},
			{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll},
		},
	),
	)
}

// CopyPermissions copies the resource permissions from one receiver uid to a new uid. This is a temporary
// method to be used during receiver renaming that is necessitated by receiver uids being generated from the receiver
// name.
func (r ReceiverPermissionsService) CopyPermissions(ctx context.Context, orgID int64, user identity.Requester, oldUID, newUID string) (int, error) {
	currentPermissions, err := r.GetPermissions(ctx, copyPermissionUser(orgID), oldUID)
	if err != nil {
		return 0, err
	}

	setPermissionCommands := r.toSetResourcePermissionCommands(currentPermissions)
	if _, err := r.SetPermissions(ctx, orgID, newUID, setPermissionCommands...); err != nil {
		return 0, err
	}

	// Clear permission cache for the user who updated the receiver, so that new permissions are fetched for their next call
	// Required for cases when caller wants to immediately interact with the newly updated object
	if user != nil && user.IsIdentityType(claims.TypeUser) {
		r.ac.ClearUserPermissionCache(user)
	}

	return countCustomPermissions(setPermissionCommands), nil
}

func (r ReceiverPermissionsService) toSetResourcePermissionCommands(permissions []accesscontrol.ResourcePermission) []accesscontrol.SetResourcePermissionCommand {
	cmds := make([]accesscontrol.SetResourcePermissionCommand, 0, len(permissions))
	for _, p := range permissions {
		if !p.IsManaged {
			continue
		}
		permission := r.MapActions(p)
		if permission == "" {
			continue
		}
		//if p.BuiltInRole == "Admin" && p.Permission == "Admin" {
		//	continue // No need to set the admin role.
		//}
		cmds = append(cmds, accesscontrol.SetResourcePermissionCommand{
			Permission:  permission,
			BuiltinRole: p.BuiltInRole,
			TeamID:      p.TeamId,
			UserID:      p.UserId,
		})
	}
	return cmds
}

func countCustomPermissions(permissions []accesscontrol.SetResourcePermissionCommand) int {
	cacheKey := func(p accesscontrol.SetResourcePermissionCommand) accesscontrol.SetResourcePermissionCommand {
		return accesscontrol.SetResourcePermissionCommand{
			Permission:  "",
			BuiltinRole: p.BuiltinRole,
			TeamID:      p.TeamID,
			UserID:      p.UserID,
		}
	}
	missingDefaults := make(map[accesscontrol.SetResourcePermissionCommand]string, 2)
	for _, p := range defaultPermissions() {
		missingDefaults[cacheKey(p)] = p.Permission
	}

	diff := 0
	for _, p := range permissions {
		key := cacheKey(p)
		perm, ok := missingDefaults[key]
		if perm != p.Permission {
			diff++
		}
		if ok {
			delete(missingDefaults, key)
		}
	}

	// missing + new
	return len(missingDefaults) + diff
}

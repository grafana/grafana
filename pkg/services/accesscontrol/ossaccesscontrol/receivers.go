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
	"github.com/grafana/grafana/pkg/services/ngalert"
	alertingac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ReceiversViewActions  = []string{accesscontrol.ActionAlertingReceiversRead}
	ReceiversEditActions  = append(ReceiversViewActions, []string{accesscontrol.ActionAlertingReceiversUpdate, accesscontrol.ActionAlertingReceiversDelete}...)
	ReceiversAdminActions = append(ReceiversEditActions, []string{accesscontrol.ActionAlertingReceiversReadSecrets, accesscontrol.ActionAlertingReceiversPermissionsRead, accesscontrol.ActionAlertingReceiversPermissionsWrite}...)
)

// defaultPermissions returns the default permissions for a newly created receiver.
func defaultPermissions() []accesscontrol.SetResourcePermissionCommand {
	return []accesscontrol.SetResourcePermissionCommand{
		{BuiltinRole: string(org.RoleEditor), Permission: string(alertingac.ReceiverPermissionEdit)},
		{BuiltinRole: string(org.RoleViewer), Permission: string(alertingac.ReceiverPermissionView)},
	}
}

func ProvideReceiverPermissionsService(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, router routing.RouteRegister, sql db.DB, ac accesscontrol.AccessControl,
	license licensing.Licensing, service accesscontrol.Service,
	teamService team.Service, userService user.Service, actionSetService resourcepermissions.ActionSetService,
) (*ReceiverPermissionsService, error) {
	options := resourcepermissions.Options{
		Resource:          "receivers",
		ResourceAttribute: "uid",
		ResourceTranslator: func(ctx context.Context, orgID int64, resourceID string) (string, error) {
			return alertingac.ScopeReceiversProvider.GetResourceIDFromUID(resourceID), nil
		},
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

	srv, err := resourcepermissions.New(setting.ProvideService(cfg), options, features, router, license, ac, service, sql, teamService, userService, actionSetService)
	if err != nil {
		return nil, err
	}
	return &ReceiverPermissionsService{Service: srv, ac: service, log: log.New("resourcepermissions.receivers")}, nil
}

var _ accesscontrol.ReceiverPermissionsService = new(ReceiverPermissionsService)

type ReceiverPermissionsService struct {
	*resourcepermissions.Service
	ac  accesscontrol.Service
	log log.Logger
}

// SetDefaultPermissions sets the default permissions for a newly created receiver.
func (r ReceiverPermissionsService) SetDefaultPermissions(ctx context.Context, orgID int64, user identity.Requester, uid string) {
	r.log.Debug("Setting default permissions for receiver", "receiver_uid", uid)
	resourceId := alertingac.ScopeReceiversProvider.GetResourceIDFromUID(uid)
	permissions := defaultPermissions()
	clearCache := false
	if user != nil && user.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		userID, err := user.GetInternalID()
		if err != nil {
			r.log.Error("Could not make user admin", "receiver_uid", uid, "resource_id", resourceId, "id", user.GetID(), "error", err)
		} else {
			permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
				UserID: userID, Permission: string(alertingac.ReceiverPermissionAdmin),
			})
			clearCache = true
		}
	}

	if _, err := r.SetPermissions(ctx, orgID, resourceId, permissions...); err != nil {
		r.log.Error("Could not set default permissions", "receiver_uid", uid, "resource_id", resourceId, "id", "error", err)
	}

	if clearCache {
		// Clear permission cache for the user who created the receiver, so that new permissions are fetched for their next call
		// Required for cases when caller wants to immediately interact with the newly created object
		r.ac.ClearUserPermissionCache(user)
	}
}

// copyPermissionUser returns a user with permissions to copy permissions from one receiver to another. This must include
// permissions to read and write permissions for the receiver, as well as read permissions for users, service accounts, and teams.
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
	r.log.Debug("Copying permissions from receiver", "old_uid", oldUID, "new_uid", newUID)
	oldResourceId := alertingac.ScopeReceiversProvider.GetResourceIDFromUID(oldUID)
	newResourceId := alertingac.ScopeReceiversProvider.GetResourceIDFromUID(newUID)
	currentPermissions, err := r.GetPermissions(ctx, copyPermissionUser(orgID), oldResourceId)
	if err != nil {
		return 0, err
	}

	setPermissionCommands := r.toSetResourcePermissionCommands(currentPermissions)
	if _, err := r.SetPermissions(ctx, orgID, newResourceId, setPermissionCommands...); err != nil {
		return 0, err
	}

	// Clear permission cache for the user who updated the receiver, so that new permissions are fetched for their next call
	// Required for cases when caller wants to immediately interact with the newly updated object
	if user != nil && user.IsIdentityType(claims.TypeUser) {
		// A more comprehensive means of clearing the user's permissions cache than ClearUserPermissionCache.
		// It also clears the cache for basic roles and teams, which is required for the user to not have temporarily
		// broken UI permissions when their source of elevated permissions comes from a cached team or basic role
		// permission.
		_, err = r.ac.GetUserPermissions(ctx, user, accesscontrol.Options{ReloadCache: true})
		if err != nil {
			r.log.Debug("Failed to clear user permissions cache", "error", err)
		}
	}

	return countCustomPermissions(setPermissionCommands), nil
}

func (r ReceiverPermissionsService) DeleteResourcePermissions(ctx context.Context, orgID int64, uid string) error {
	return r.Service.DeleteResourcePermissions(ctx, orgID, alertingac.ScopeReceiversProvider.GetResourceIDFromUID(uid))
}

// toSetResourcePermissionCommands converts a list of resource permissions to a list of set resource permission commands.
// Only includes managed permissions.
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
		cmds = append(cmds, accesscontrol.SetResourcePermissionCommand{
			Permission:  permission,
			BuiltinRole: p.BuiltInRole,
			TeamID:      p.TeamID,
			UserID:      p.UserID,
		})
	}
	return cmds
}

// countCustomPermissions counts the number of custom permissions in a list of set resource permission commands. A
// custom permission is a permission that is not a default permission for a receiver.
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

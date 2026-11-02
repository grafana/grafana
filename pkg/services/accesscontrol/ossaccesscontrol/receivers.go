package ossaccesscontrol

import (
	"context"
	"time"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	iamapi "github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permissioncache"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var ReceiversViewActions = []string{accesscontrol.ActionAlertingReceiversRead}
var ReceiversEditActions = append(ReceiversViewActions, []string{accesscontrol.ActionAlertingReceiversUpdate, accesscontrol.ActionAlertingReceiversDelete, accesscontrol.ActionAlertingReceiversTestCreate}...)
var ReceiversAdminActions = append(ReceiversEditActions, []string{accesscontrol.ActionAlertingReceiversReadSecrets, accesscontrol.ActionAlertingReceiversPermissionsRead, accesscontrol.ActionAlertingReceiversPermissionsWrite, accesscontrol.ActionAlertingReceiversUpdateProtected}...)

// defaultPermissions returns the default permissions for a newly created receiver.
func defaultPermissions() []accesscontrol.SetResourcePermissionCommand {
	return []accesscontrol.SetResourcePermissionCommand{
		{BuiltinRole: string(org.RoleEditor), Permission: string(models.PermissionEdit)},
		{BuiltinRole: string(org.RoleViewer), Permission: string(models.PermissionView)},
	}
}

// ReceiverPermissionsRoleRegistrations returns the templated reader/writer fixed
// roles for alerting receiver resource permissions
// (fixed:receivers.permissions:reader and :writer). These mirror the roles
// declared by ProvideReceiverPermissionsService through resourcepermissions.New;
// the identity fields below must match the Options passed there.
func ReceiverPermissionsRoleRegistrations() []accesscontrol.RoleRegistration {
	return resourcepermissions.FixedRoleRegistrations(resourcepermissions.Options{
		Resource:       receiverPermissionsResource,
		APIGroup:       accesscontrol.AlertingNotificationsApiGroup,
		ReaderRoleName: receiverPermissionsReaderRoleName,
		WriterRoleName: receiverPermissionsWriterRoleName,
		RoleGroup:      models.AlertRolesGroup,
	})
}

func ProvideReceiverPermissionsService(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, router routing.RouteRegister, sql *sqlstore.SQLStore, ac accesscontrol.AccessControl,
	iamFeatures iamapi.Features,
	license licensing.Licensing, service accesscontrol.Service,
	teamService team.Service, userService user.Service, serviceAccountRetriever serviceaccounts.ServiceAccountRetriever,
	actionSetService resourcepermissions.ActionSetService,
) (*ReceiverPermissionsService, error) {
	options := resourcepermissions.Options{
		Resource:          receiverPermissionsResource,
		APIGroup:          accesscontrol.AlertingNotificationsApiGroup,
		ResourceAttribute: "uid",
		ResourceTranslator: func(ctx context.Context, orgID int64, resourceID string) (string, error) {
			return models.ScopeReceiversProvider.GetResourceIDFromUID(resourceID), nil
		},
		Assignments: resourcepermissions.Assignments{
			Users:           true,
			Teams:           true,
			BuiltInRoles:    true,
			ServiceAccounts: true,
		},
		PermissionsToActions: map[string][]string{
			string(models.PermissionView):  append([]string{}, ReceiversViewActions...),
			string(models.PermissionEdit):  append([]string{}, ReceiversEditActions...),
			string(models.PermissionAdmin): append([]string{}, ReceiversAdminActions...),
		},
		ReaderRoleName: receiverPermissionsReaderRoleName,
		WriterRoleName: receiverPermissionsWriterRoleName,
		RoleGroup:      models.AlertRolesGroup,
	}

	srv, err := resourcepermissions.New(cfg, options, features, router, license, ac, service, sql, teamService, userService, serviceAccountRetriever, actionSetService, iamFeatures)
	if err != nil {
		return nil, err
	}
	receivers := &ReceiverPermissionsService{Service: srv, sql: sql, ac: service, log: log.New("resourcepermissions.receivers")}
	sql.Bus().AddEventListener(receivers.onPermissionsCopied)
	sql.Bus().AddEventListener(receivers.onDefaultPermissionsSet)
	return receivers, nil
}

var _ accesscontrol.ReceiverPermissionsService = (*ReceiverPermissionsService)(nil)

type ReceiverPermissionsService struct {
	*resourcepermissions.Service
	ac  accesscontrol.Service
	sql db.DB
	log log.Logger
}

// receiverPermissionsCopied is an in-process notification, not a durable delivery record.
type receiverPermissionsCopied struct {
	user identity.Requester
}

// SetDefaultPermissions sets the default permissions for a newly created receiver.
func (r ReceiverPermissionsService) SetDefaultPermissions(ctx context.Context, orgID int64, user identity.Requester, uid string) {
	r.log.Debug("Setting default permissions for receiver", "receiver_uid", uid)
	resourceId := models.ScopeReceiversProvider.GetResourceIDFromUID(uid)
	permissions := defaultPermissions()
	clearCache := false
	if user != nil && user.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		userID, err := user.GetInternalID()
		if err != nil {
			r.log.Error("Could not make user admin", "receiver_uid", uid, "resource_id", resourceId, "id", user.GetID(), "error", err)
		} else {
			permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
				UserID: userID, Permission: string(models.PermissionAdmin),
			})
			clearCache = true
		}
	}

	if _, err := r.SetPermissions(ctx, orgID, resourceId, permissions...); err != nil {
		r.log.Error("Could not set default permissions", "receiver_uid", uid, "resource_id", resourceId, "id", "error", err)
		return
	}

	if clearCache {
		event := &receiverDefaultPermissionsSet{requester: user}
		if sess := sqlstore.SessionFromContext(ctx); sess != nil {
			sess.PublishAfterCommit(event)
		} else {
			_ = r.onDefaultPermissionsSet(ctx, event)
		}
	}
}

type receiverDefaultPermissionsSet struct {
	requester identity.Requester
}

func (r ReceiverPermissionsService) onDefaultPermissionsSet(ctx context.Context, event *receiverDefaultPermissionsSet) error {
	permissioncache.RefreshCreator(ctx, r.ac, event.requester)
	return nil
}

// copyPermissionUser returns a user with permissions to copy permissions from one receiver to another. This must include
// permissions to read and write permissions for the receiver, as well as read permissions for users, service accounts, and teams.
func copyPermissionUser(orgID int64) identity.Requester {
	return accesscontrol.BackgroundUser("receiver_access_service", orgID, org.RoleAdmin, accesscontrol.ConcatPermissions(
		accesscontrol.PermissionsForActions(ReceiversAdminActions, models.ScopeReceiversAll),
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
	oldResourceId := models.ScopeReceiversProvider.GetResourceIDFromUID(oldUID)
	newResourceId := models.ScopeReceiversProvider.GetResourceIDFromUID(newUID)
	var copied int
	err := r.sql.InTransaction(ctx, func(ctx context.Context) error {
		currentPermissions, err := r.GetPermissions(ctx, copyPermissionUser(orgID), oldResourceId)
		if err != nil {
			return err
		}

		setPermissionCommands := r.toSetResourcePermissionCommands(currentPermissions)
		if _, err := r.SetPermissions(ctx, orgID, newResourceId, setPermissionCommands...); err != nil {
			return err
		}

		if user != nil && user.IsIdentityType(claims.TypeUser) {
			// Queue on the shared session so nested calls wait for the outermost commit.
			sqlstore.SessionFromContext(ctx).PublishAfterCommit(&receiverPermissionsCopied{user: user})
		}
		copied = countCustomPermissions(setPermissionCommands)
		return nil
	})
	if err != nil {
		return 0, err
	}
	return copied, nil
}

func (r ReceiverPermissionsService) onPermissionsCopied(ctx context.Context, event *receiverPermissionsCopied) error {
	if err := r.refreshPermissions(ctx, event.user); err != nil {
		_ = tracing.Error(trace.SpanFromContext(ctx), err)
	}
	// The mutation already committed. Refresh failures must not fail event delivery.
	return nil
}

func (r ReceiverPermissionsService) refreshPermissions(ctx context.Context, user identity.Requester) error {
	if user == nil || !user.IsIdentityType(claims.TypeUser) {
		return nil
	}
	inTransaction := sqlstore.IsInTransaction(ctx)
	ctx, span := tracing.Start(ctx, "accesscontrol.ossaccesscontrol.RefreshPermissions", attribute.Bool("is_in_tx", inTransaction))
	defer span.End()

	// Remote AuthZ cannot see uncommitted changes, so a reload inside a transaction can cache old permissions.
	if inTransaction {
		return nil
	}

	// Reload also refreshes basic-role and team caches, which ClearUserPermissionCache does not clear.
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	_, err := r.ac.GetUserPermissions(ctx, user, accesscontrol.Options{ReloadCache: true})
	return err
}

func (r ReceiverPermissionsService) DeleteResourcePermissions(ctx context.Context, orgID int64, uid string) error {
	return r.Service.DeleteResourcePermissions(ctx, orgID, models.ScopeReceiversProvider.GetResourceIDFromUID(uid))
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

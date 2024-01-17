package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errInvalidCloudRole         = errutil.BadRequest("rbac.sync.invalid-cloud-role")
	errSyncPermissionsForbidden = errutil.Forbidden("permissions.sync.forbidden")
)

func ProvideRBACSync(acService accesscontrol.Service) *RBACSync {
	return &RBACSync{
		ac:  acService,
		log: log.New("permissions.sync"),
	}
}

type RBACSync struct {
	ac  accesscontrol.Service
	log log.Logger
}

func (s *RBACSync) SyncPermissionsHook(ctx context.Context, ident *authn.Identity, _ *authn.Request) error {
	if !ident.ClientParams.SyncPermissions {
		return nil
	}

	permissions, err := s.ac.GetUserPermissions(ctx, ident, accesscontrol.Options{ReloadCache: false})
	if err != nil {
		s.log.FromContext(ctx).Error("Failed to fetch permissions from db", "error", err, "id", ident.ID)
		return errSyncPermissionsForbidden
	}

	if ident.Permissions == nil {
		ident.Permissions = make(map[int64]map[string][]string)
	}
	ident.Permissions[ident.OrgID] = accesscontrol.GroupScopesByAction(permissions)
	return nil
}

var fixedCloudRoles = map[org.RoleType]string{
	org.RoleViewer: accesscontrol.FixedCloudViewerRole,
	org.RoleEditor: accesscontrol.FixedCloudEditorRole,
	org.RoleAdmin:  accesscontrol.FixedCloudAdminRole,
}

func (s *RBACSync) SyncCloudRoles(ctx context.Context, ident *authn.Identity, r *authn.Request) error {
	// we only want to run this hook during login and if the module used is grafana com
	if r.GetMeta(authn.MetaKeyAuthModule) != login.GrafanaComAuthModule {
		return nil
	}

	namespace, id := ident.GetNamespacedID()
	if namespace != authn.NamespaceUser {
		s.log.FromContext(ctx).Debug("Skip syncing cloud role", "id", ident.ID)
		return nil
	}

	userID, err := identity.IntIdentifier(namespace, id)
	if err != nil {
		return err
	}

	rolesToAdd := make([]string, 0, 1)
	rolesToRemove := make([]string, 0, 2)

	for role, fixedRole := range fixedCloudRoles {
		if role == ident.GetOrgRole() {
			rolesToAdd = append(rolesToAdd, fixedRole)
		} else {
			rolesToRemove = append(rolesToRemove, fixedRole)
		}
	}

	if len(rolesToAdd) != 1 {
		return errInvalidCloudRole.Errorf("invalid role: %s", ident.GetOrgRole())
	}

	return s.ac.SyncUserRoles(ctx, ident.GetOrgID(), accesscontrol.SyncUserRolesCommand{
		UserID:        userID,
		RolesToAdd:    rolesToAdd,
		RolesToRemove: rolesToRemove,
	})
}

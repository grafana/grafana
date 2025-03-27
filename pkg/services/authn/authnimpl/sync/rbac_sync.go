package sync

import (
	"context"
	"errors"

	"golang.org/x/exp/maps"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
)

var (
	errInvalidCloudRole         = errutil.BadRequest("rbac.sync.invalid-cloud-role")
	errSyncPermissionsForbidden = errutil.Forbidden("permissions.sync.forbidden")
)

func ProvideRBACSync(acService accesscontrol.Service, tracer tracing.Tracer, permRegistry permreg.PermissionRegistry) *RBACSync {
	return &RBACSync{
		ac:           acService,
		log:          log.New("permissions.sync"),
		permRegistry: permRegistry,
		tracer:       tracer,
	}
}

type RBACSync struct {
	ac           accesscontrol.Service
	permRegistry permreg.PermissionRegistry
	log          log.Logger
	tracer       tracing.Tracer
}

func (s *RBACSync) SyncPermissionsHook(ctx context.Context, ident *authn.Identity, _ *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "rbac.sync.SyncPermissionsHook")
	defer span.End()

	if !ident.ClientParams.SyncPermissions {
		return nil
	}

	// Populate permissions from roles
	permissions, err := s.fetchPermissions(ctx, ident)
	if err != nil {
		return err
	}

	if ident.Permissions == nil {
		ident.Permissions = make(map[int64]map[string][]string, 1)
	}

	grouped := accesscontrol.GroupScopesByActionContext(ctx, permissions)

	// Restrict access to the list of actions
	actionsLookup := ident.ClientParams.FetchPermissionsParams.RestrictedActions
	if len(actionsLookup) > 0 {
		filtered := make(map[string][]string, len(actionsLookup))
		for _, action := range actionsLookup {
			if scopes, ok := grouped[action]; ok {
				filtered[action] = scopes
			}
		}
		grouped = filtered
	}
	ident.Permissions[ident.OrgID] = grouped

	return nil
}

func (s *RBACSync) fetchPermissions(ctx context.Context, ident *authn.Identity) ([]accesscontrol.Permission, error) {
	ctx, span := s.tracer.Start(ctx, "rbac.sync.fetchPermissions")
	defer span.End()

	permissions := make([]accesscontrol.Permission, 0, 8)
	roles := ident.ClientParams.FetchPermissionsParams.Roles
	actions := ident.ClientParams.FetchPermissionsParams.AllowedActions
	if len(roles) > 0 || len(actions) > 0 {
		for _, role := range roles {
			roleDTO, err := s.ac.GetRoleByName(ctx, ident.GetOrgID(), role)
			if err != nil && !errors.Is(err, accesscontrol.ErrRoleNotFound) {
				s.log.FromContext(ctx).Error("Failed to fetch role from db", "error", err, "role", role)
				return nil, errSyncPermissionsForbidden
			}
			if roleDTO != nil {
				permissions = append(permissions, roleDTO.Permissions...)
			}
		}
		for _, action := range actions {
			scopes, ok := s.permRegistry.GetScopePrefixes(action)
			if !ok {
				s.log.Warn("Unknown action scopes", "action", action)
				continue
			}
			if len(scopes) == 0 {
				permissions = append(permissions, accesscontrol.Permission{Action: action})
				continue
			}
			for scope := range scopes {
				permissions = append(permissions, accesscontrol.Permission{Action: action, Scope: scope + "*"})
			}
		}
		return permissions, nil
	}

	permissions, err := s.ac.GetUserPermissions(ctx, ident, accesscontrol.Options{ReloadCache: false})
	if err != nil {
		s.log.FromContext(ctx).Error("Failed to fetch permissions from db", "error", err, "id", ident.ID)
		return nil, errSyncPermissionsForbidden
	}
	return permissions, nil
}

func cloudRolesToAddAndRemove(ident *authn.Identity) ([]string, []string, error) {
	// Since Cloud Admin/Editor/Viewer roles are not yet implemented one-to-one in the Grafana, it becomes a confusing experience for users,
	// therefore we are doing granular mapping of all available functionality in the Grafana temporary.
	var fixedCloudRoles = map[org.RoleType][]string{
		org.RoleViewer: {accesscontrol.FixedCloudViewerRole, accesscontrol.FixedCloudSupportTicketReader},
		org.RoleEditor: {accesscontrol.FixedCloudEditorRole, accesscontrol.FixedCloudSupportTicketAdmin},
		org.RoleAdmin:  {accesscontrol.FixedCloudAdminRole, accesscontrol.FixedCloudSupportTicketAdmin},
	}

	rolesToAdd := make(map[string]bool)
	rolesToRemove := make([]string, 0, 4)

	currentRole := ident.GetOrgRole()
	_, validRole := fixedCloudRoles[currentRole]

	if !validRole {
		return nil, nil, errInvalidCloudRole.Errorf("invalid role: %s", currentRole)
	}

	// Add roles for the current role and track them
	for _, fixedRole := range fixedCloudRoles[currentRole] {
		rolesToAdd[fixedRole] = true
	}

	// Add roles to remove, ensuring we don't remove any that have been added
	for role, fixedRoles := range fixedCloudRoles {
		if role == currentRole {
			continue
		}
		for _, fixedRole := range fixedRoles {
			if _, ok := rolesToAdd[fixedRole]; !ok {
				rolesToRemove = append(rolesToRemove, fixedRole)
			}
		}
	}

	return maps.Keys(rolesToAdd), rolesToRemove, nil
}

func (s *RBACSync) SyncCloudRoles(ctx context.Context, ident *authn.Identity, r *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "rbac.sync.SyncCloudRoles")
	defer span.End()

	// we only want to run this hook during login and if the module used is grafana com
	if r.GetMeta(authn.MetaKeyAuthModule) != login.GrafanaComAuthModule {
		return nil
	}

	if !ident.IsIdentityType(claims.TypeUser) {
		s.log.FromContext(ctx).Debug("Skip syncing cloud role", "id", ident.ID)
		return nil
	}

	userID, err := ident.GetInternalID()
	if err != nil {
		return err
	}

	rolesToAdd, rolesToRemove, err := cloudRolesToAddAndRemove(ident)
	if err != nil {
		return err
	}

	return s.ac.SyncUserRoles(ctx, ident.GetOrgID(), accesscontrol.SyncUserRolesCommand{
		UserID:        userID,
		RolesToAdd:    rolesToAdd,
		RolesToRemove: rolesToRemove,
	})
}

package sync

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"go.opentelemetry.io/otel/attribute"
)

var (
	errInvalidCloudRole         = errutil.BadRequest("rbac.sync.invalid-cloud-role")
	errSyncPermissionsForbidden = errutil.Forbidden("permissions.sync.forbidden")
)

func ProvideRBACSync(acService accesscontrol.Service, tracer tracing.Tracer) *RBACSync {
	return &RBACSync{
		ac:     acService,
		log:    log.New("permissions.sync"),
		tracer: tracer,
	}
}

type RBACSync struct {
	ac     accesscontrol.Service
	log    log.Logger
	tracer tracing.Tracer
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

	start := time.Now()
	grouped := accesscontrol.GroupScopesByAction(permissions)
	elapsed := time.Since(start)

	span.SetAttributes(attribute.Int("group_time_ms", int(elapsed.Milliseconds())))

	// Restrict access to the list of actions
	start = time.Now()
	actionsLookup := ident.ClientParams.FetchPermissionsParams.ActionsLookup
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
	elapsed = time.Since(start)

	span.SetAttributes(attribute.Int("filter_time_ms", int(elapsed.Milliseconds())))

	return nil
}

func (s *RBACSync) fetchPermissions(ctx context.Context, ident *authn.Identity) ([]accesscontrol.Permission, error) {
	ctx, span := s.tracer.Start(ctx, "rbac.sync.fetchPermissions")
	defer span.End()

	permissions := make([]accesscontrol.Permission, 0, 8)
	roles := ident.ClientParams.FetchPermissionsParams.Roles
	if len(roles) > 0 {
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

		return permissions, nil
	}

	permissions, err := s.ac.GetUserPermissions(ctx, ident, accesscontrol.Options{ReloadCache: false})
	if err != nil {
		s.log.FromContext(ctx).Error("Failed to fetch permissions from db", "error", err, "id", ident.ID)
		return nil, errSyncPermissionsForbidden
	}
	return permissions, nil
}

var fixedCloudRoles = map[org.RoleType]string{
	org.RoleViewer: accesscontrol.FixedCloudViewerRole,
	org.RoleEditor: accesscontrol.FixedCloudEditorRole,
	org.RoleAdmin:  accesscontrol.FixedCloudAdminRole,
}

func (s *RBACSync) SyncCloudRoles(ctx context.Context, ident *authn.Identity, r *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "rbac.sync.SyncCloudRoles")
	defer span.End()

	// we only want to run this hook during login and if the module used is grafana com
	if r.GetMeta(authn.MetaKeyAuthModule) != login.GrafanaComAuthModule {
		return nil
	}

	if !ident.ID.IsNamespace(authn.NamespaceUser) {
		s.log.FromContext(ctx).Debug("Skip syncing cloud role", "id", ident.ID)
		return nil
	}

	userID, err := ident.ID.ParseInt()
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

package rbac

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/types"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

// LegacyCheck is a deprecated compatibility RPC used by ST callers during the
// migration from local AccessControl evaluation to centralized AuthZ checks.
// Evaluation failures are returned as deny-with-error to avoid fail-open.
func (s *Service) LegacyCheck(ctx context.Context, req *authzextv1.LegacyCheckRequest) (*authzextv1.LegacyCheckResponse, error) {
	// TODO: Complete in subsequent PRs:
	//   - Scope resolution: inheritance, MutateScopes after denial, errors and WithoutResolvers.
	//   - Resolver caching: tenant isolation, bypass and invalidation.
	//   - Permissions: NoOrgID globals, contextual team grants and SharedWithMe.
	ns, err := validateNamespace(ctx, req.GetNamespace())
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}
	userUID, idType, err := s.validateSubject(ctx, req.GetSubject())
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}
	ctx = request.WithNamespace(ctx, ns.Value)

	evaluator, actions, err := convertLegacyExpression(req.GetExpression())
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}

	// AccessControl denies an identity with no permissions at all.
	// See pkg/services/accesscontrol/acimpl/accesscontrol.go:66 (AccessControl.evaluate).
	//
	// Our queries only load permissions for the actions in this request. An empty
	// result may mean the identity has permissions for other actions.
	// An empty ALL returns true even with no permissions. Evaluate(nil) checks
	// whether this expression can do that. If it can, and our queries return
	// nothing, we must check for other permissions before allowing the request.
	checkUnrelatedPermissions := evaluator.Evaluate(nil)
	permissions, hasPermissions, err := s.getLegacyIdentityPermissions(
		ctx, ns, idType, userUID, actions, checkUnrelatedPermissions, req.GetSkipCache(),
	)
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}
	if !hasPermissions {
		return &authzextv1.LegacyCheckResponse{Allowed: false}, nil
	}

	allowed := evaluator.Evaluate(permissions)

	return &authzextv1.LegacyCheckResponse{Allowed: allowed}, nil
}

func (s *Service) getLegacyIdentityPermissions(
	ctx context.Context,
	ns types.NamespaceInfo,
	idType types.IdentityType,
	userUID string,
	actions []string,
	checkUnrelatedPermissions,
	skipCache bool,
) (map[string][]string, bool, error) {
	permissions := make(map[string][]string, len(actions))
	query := store.PermissionsQuery{}
	switch idType {
	case types.TypeUser, types.TypeServiceAccount:
		identifiers, err := s.getUserIdentifiers(ctx, ns, userUID, skipCache)
		if err != nil {
			return nil, false, err
		}

		query, err = s.getLegacyUserPermissionQuery(ctx, ns, identifiers, skipCache)
		if err != nil {
			return nil, false, err
		}
	case types.TypeAnonymous:
		query.Role = s.settings.AnonOrgRole
	case types.TypeRenderService:
		for _, action := range actions {
			scopes, err := s.getRendererPermissions(ctx, action)
			if err != nil {
				return nil, false, err
			}
			if scopes["*"] {
				permissions[action] = []string{"*"}
			}
		}
		// Render identities always have fixed grants, even when none of the
		// requested actions match them. Their permission set is never empty.
		return permissions, true, nil
	default:
		return nil, false, fmt.Errorf("unsupported identity type: %s", idType)
	}

	for _, action := range actions {
		actionQuery := query
		actionQuery.Action = action
		if s.actionResolver != nil {
			actionQuery.ActionSets = s.actionResolver.ResolveAction(action)
		}

		grants, err := s.permissionStore.GetUserPermissions(ctx, ns, actionQuery)
		if err != nil {
			return nil, false, err
		}
		// Modern Kubernetes checks normalize scopes. Legacy evaluators need
		// the original strings, including empty scopes on action-only grants.
		for _, grant := range grants {
			permissions[action] = append(permissions[action], grant.Scope)
		}
	}

	if len(permissions) > 0 {
		return permissions, true, nil
	}
	if !checkUnrelatedPermissions {
		return permissions, false, nil
	}

	// Keep the identity/role/team query but omit action filtering. The current
	// store interface returns the snapshot; only its presence is needed here.
	grants, err := s.permissionStore.GetUserPermissions(ctx, ns, query)
	if err != nil {
		return nil, false, err
	}

	return permissions, len(grants) > 0, nil
}

func (s *Service) getLegacyUserPermissionQuery(
	ctx context.Context,
	ns types.NamespaceInfo,
	userIdentifiers *store.UserIdentifiers,
	skipCache bool,
) (store.PermissionsQuery, error) {
	basicRole, err := s.getUserBasicRoleWithCache(ctx, ns, userIdentifiers, skipCache)
	if err != nil {
		return store.PermissionsQuery{}, err
	}

	teamIDs, err := s.getUserTeamsWithCache(ctx, ns, userIdentifiers, skipCache)
	if err != nil {
		return store.PermissionsQuery{}, err
	}

	return store.PermissionsQuery{
		UserID:        userIdentifiers.ID,
		TeamIDs:       teamIDs,
		Role:          basicRole.Role,
		IsServerAdmin: basicRole.IsAdmin,
	}, nil
}

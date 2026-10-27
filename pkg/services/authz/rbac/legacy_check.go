package rbac

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

// LegacyCheck is a deprecated compatibility RPC used by ST callers during the
// migration from local AccessControl evaluation to centralized AuthZ checks.
// Evaluation failures are returned as deny-with-error to avoid fail-open.
func (s *Service) LegacyCheck(ctx context.Context, req *authzextv1.LegacyCheckRequest) (*authzextv1.LegacyCheckResponse, error) {
	// TODO: Complete in subsequent PRs:
	//   - Standalone scope resolution: replace embedded service dependencies with namespace-aware providers.
	//			MT AuthZ: https://github.com/grafana/identity-access-team/issues/2436
	//   - Permissions: NoOrgID globals, contextual team grants and SharedWithMe.
	ns, err := validateNamespace(ctx, req.GetNamespace())
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}

	if err := s.validateLegacyScopeNamespace(ns); err != nil {
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

	// AccessControl denies an identity when its full permission map is empty.
	// See pkg/services/accesscontrol/acimpl/accesscontrol.go:71 (AccessControl.evaluate).
	//
	// Our queries only load permissions for the actions in this request. An empty
	// result may mean the identity has permissions for other actions.
	// An empty ALL returns true even with no permissions. Evaluate(nil) checks
	// whether this expression can do that.
	//
	// After direct evaluation denies, AccessControl attempts scope mutation if
	// the full permission map is non-empty, even if it only contains other actions.
	// See pkg/services/accesscontrol/acimpl/accesscontrol.go:82 (AccessControl.evaluate).
	//
	// If either case applies and our queries return nothing, check for other
	// permissions before allowing the request or skipping resolution.
	checkUnrelatedPermissions := evaluator.Evaluate(nil) ||
		(!req.GetSkipScopeResolution() && s.legacyScopeResolvers.HasResolvers())

	permissions, hasAnyPermissions, err := s.getLegacyIdentityPermissions(
		ctx,
		ns,
		idType,
		userUID,
		actions,
		checkUnrelatedPermissions,
		req.GetSkipCache(),
	)
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}

	if !hasAnyPermissions {
		return &authzextv1.LegacyCheckResponse{Allowed: false}, nil
	}

	allowed, err := s.evaluateLegacyWithResolvers(
		ctx,
		evaluator,
		permissions,
		hasAnyPermissions,
		req.GetSkipScopeResolution(),
		legacyScopeRequest{
			namespace:    ns,
			identityType: idType,
			userUID:      userUID,
			skipCache:    req.GetSkipCache(),
		},
	)
	if err != nil {
		code := authzextv1.LegacyCheckErrorCode_LEGACY_CHECK_ERROR_CODE_UNSPECIFIED
		if errors.Is(err, accesscontrol.ErrScopeResourceNotFound) {
			code = authzextv1.LegacyCheckErrorCode_LEGACY_CHECK_ERROR_CODE_SCOPE_RESOURCE_NOT_FOUND
		}
		return &authzextv1.LegacyCheckResponse{
			Allowed:   false,
			Error:     err.Error(),
			ErrorCode: code,
		}, nil
	}

	return &authzextv1.LegacyCheckResponse{Allowed: allowed}, nil
}

// getLegacyIdentityScopes loads one action for resolver callbacks that perform
// further checks as the subject. Composite checks use getLegacyIdentityPermissions.
func (s *Service) getLegacyIdentityScopes(
	ctx context.Context,
	ns types.NamespaceInfo,
	idType types.IdentityType,
	userUID string,
	action string,
	checkUnrelatedPermissions bool,
	skipCache bool,
) ([]string, bool, error) {
	permissions, hasAnyPermissions, err := s.getLegacyIdentityPermissions(
		ctx,
		ns,
		idType,
		userUID,
		[]string{action},
		checkUnrelatedPermissions,
		skipCache,
	)
	if err != nil {
		return nil, false, fmt.Errorf("could not get legacy identity permissions: %w", err)
	}

	return permissions[action], hasAnyPermissions, nil
}

// getLegacyIdentityPermissions returns grants for the requested actions and whether
// any permissions were found. The boolean can be true even when the map is empty:
// render identities have fixed grants, and checkUnrelatedPermissions enables a
// lookup for grants on other actions when the requested actions have none.
func (s *Service) getLegacyIdentityPermissions(
	ctx context.Context,
	ns types.NamespaceInfo,
	idType types.IdentityType,
	userUID string,
	actions []string,
	checkUnrelatedPermissions bool,
	skipCache bool,
) (map[string][]string, bool, error) {
	permissions := make(map[string][]string, len(actions))
	query := store.PermissionsQuery{}
	switch idType {
	case types.TypeUser, types.TypeServiceAccount:
		identifiers, err := s.getUserIdentifiers(ctx, ns, userUID, skipCache)
		if err != nil {
			return nil, false, fmt.Errorf("could not get user identifiers: %w", err)
		}

		query, err = s.getLegacyUserPermissionQuery(ctx, ns, identifiers, skipCache)
		if err != nil {
			return nil, false, fmt.Errorf("could not get legacy user permission query: %w", err)
		}
	case types.TypeAnonymous:
		query.Role = s.settings.AnonOrgRole
	case types.TypeRenderService:
		for _, action := range actions {
			scopes, err := s.getRendererPermissions(ctx, action)
			if err != nil {
				return nil, false, fmt.Errorf("could not get renderer permissions: %w", err)
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
			return nil, false, fmt.Errorf("could not get user permissions: %w", err)
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

	// AccessControl skips resolvers only when the entire permission set is empty.
	// A filtered action query cannot establish that, so check for any grant using
	// the same identity/role/team restrictions without an action filter.
	hasAnyPermissions, err := s.permissionStore.HasUserPermissions(ctx, ns, query)
	if err != nil {
		return nil, false, fmt.Errorf("could not check user permissions: %w", err)
	}

	return permissions, hasAnyPermissions, nil
}

func (s *Service) getLegacyUserPermissionQuery(
	ctx context.Context,
	ns types.NamespaceInfo,
	userIdentifiers *store.UserIdentifiers,
	skipCache bool,
) (store.PermissionsQuery, error) {
	basicRole, err := s.getUserBasicRoleWithCache(ctx, ns, userIdentifiers, skipCache)
	if err != nil {
		return store.PermissionsQuery{}, fmt.Errorf("could not get user basic role: %w", err)
	}

	teamIDs, err := s.getUserTeamsWithCache(ctx, ns, userIdentifiers, skipCache)
	if err != nil {
		return store.PermissionsQuery{}, fmt.Errorf("could not get user teams: %w", err)
	}

	return store.PermissionsQuery{
		UserID:        userIdentifiers.ID,
		TeamIDs:       teamIDs,
		Role:          basicRole.Role,
		IsServerAdmin: basicRole.IsAdmin,
	}, nil
}

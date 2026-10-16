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
	//   - ANY/ALL execution: multi-action permission loading and empty-permission denial.
	//   - Scope resolution: inheritance, MutateScopes after denial, errors and WithoutResolvers.
	//   - Resolver caching: tenant isolation, bypass and invalidation.
	//   - Permissions: NoOrgID globals, contextual team grants, SharedWithMe and empty-permission denial.
	ns, err := validateNamespace(ctx, req.GetNamespace())
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}
	userUID, idType, err := s.validateSubject(ctx, req.GetSubject())
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}
	ctx = request.WithNamespace(ctx, ns.Value)

	evaluator, err := convertLegacyExpression(req.GetExpression())
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}
	permission := req.GetExpression().GetPermission()
	if permission == nil {
		// Composite evaluation also needs complete permission loading and the
		// AccessControl empty-permission guard before it can be enabled.
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: "composite legacy expressions are not supported yet"}, nil
	}

	scopes, err := s.getLegacyIdentityScopes(ctx, ns, idType, userUID, permission.GetAction(), req.GetSkipCache())
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}

	permissions := make(map[string][]string, 1)
	if len(scopes) > 0 {
		permissions[permission.GetAction()] = scopes
	}

	allowed := evaluator.Evaluate(permissions)

	return &authzextv1.LegacyCheckResponse{Allowed: allowed}, nil
}

func (s *Service) getLegacyIdentityScopes(
	ctx context.Context,
	ns types.NamespaceInfo,
	idType types.IdentityType,
	userUID,
	action string,
	skipCache bool,
) ([]string, error) {
	var actionSets []string
	if s.actionResolver != nil {
		actionSets = s.actionResolver.ResolveAction(action)
	}

	query := store.PermissionsQuery{Action: action, ActionSets: actionSets}
	switch idType {
	case types.TypeUser, types.TypeServiceAccount:
		identifiers, err := s.getUserIdentifiers(ctx, ns, userUID, skipCache)
		if err != nil {
			return nil, err
		}

		query, err = s.getLegacyUserPermissionQuery(ctx, ns, identifiers, action, actionSets, skipCache)
		if err != nil {
			return nil, err
		}
	case types.TypeAnonymous:
		query.Role = s.settings.AnonOrgRole
	case types.TypeRenderService:
		scopes, err := s.getRendererPermissions(ctx, action)
		if err != nil {
			return nil, err
		}

		if scopes["*"] {
			return []string{"*"}, nil
		}

		return nil, nil
	default:
		return nil, fmt.Errorf("unsupported identity type: %s", idType)
	}

	permissions, err := s.permissionStore.GetUserPermissions(ctx, ns, query)
	if err != nil {
		return nil, err
	}

	// getIdentityPermissions normalizes wildcards and resolves granted scopes for
	// Kubernetes checks. Legacy evaluators require the original scope strings.
	scopes := make([]string, 0, len(permissions))
	for _, permission := range permissions {
		scopes = append(scopes, permission.Scope)
	}

	return scopes, nil
}

func (s *Service) getLegacyUserPermissionQuery(
	ctx context.Context,
	ns types.NamespaceInfo,
	userIdentifiers *store.UserIdentifiers,
	action string,
	actionSets []string,
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
		Action:        action,
		ActionSets:    actionSets,
		TeamIDs:       teamIDs,
		Role:          basicRole.Role,
		IsServerAdmin: basicRole.IsAdmin,
	}, nil
}

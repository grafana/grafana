package rbac

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/types"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/folder"
)

// LegacyCheck is a deprecated compatibility RPC used by ST callers during the
// migration from local AccessControl evaluation to centralized AuthZ checks.
// Evaluation failures are returned as deny-with-error to avoid fail-open.
func (s *Service) LegacyCheck(ctx context.Context, req *authzextv1.LegacyCheckRequest) (*authzextv1.LegacyCheckResponse, error) {
	// TODO: Complete in subsequent PRs:
	//   - Standalone scope resolution: replace embedded service dependencies with namespace-aware providers.
	//			MT AuthZ: https://github.com/grafana/identity-access-team/issues/2436
	//   - Permissions: contextual team grants.
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

	scopeRequest := legacyScopeRequest{
		namespace:    ns,
		identityType: idType,
		userUID:      userUID,
		skipCache:    req.GetSkipCache(),
	}

	var args legacyEvaluationArgs
	if global := req.GetGlobalEvaluation(); global != nil {
		args, err = s.prepareLegacyGlobalEvaluation(ctx, global, actions, scopeRequest)
	} else {
		args, err = s.prepareLegacyOrgEvaluation(ctx, actions, scopeRequest)
	}

	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}

	if !args.hasAnyPermissions {
		return &authzextv1.LegacyCheckResponse{Allowed: false}, nil
	}

	allowed, err := s.evaluateLegacyWithResolvers(
		ctx,
		evaluator,
		args.permissions,
		args.hasAnyPermissions,
		req.GetSkipScopeResolution(),
		args.scopeRequest,
	)
	if err != nil {
		return &authzextv1.LegacyCheckResponse{
			Allowed: false,
			Error:   err.Error(),
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
	skipCache bool,
) ([]string, error) {
	permissions, err := s.getLegacyIdentityPermissions(
		ctx,
		ns,
		idType,
		userUID,
		[]string{action},
		skipCache,
	)
	if err != nil {
		return nil, fmt.Errorf("could not get legacy identity permissions: %w", err)
	}

	return permissions[action], nil
}

// getLegacyIdentityPermissions loads only the requested actions, including
// implicit grants that are not stored in the permission store.
func (s *Service) getLegacyIdentityPermissions(
	ctx context.Context,
	ns types.NamespaceInfo,
	idType types.IdentityType,
	userUID string,
	actions []string,
	skipCache bool,
) (map[string][]string, error) {
	permissions := make(map[string][]string, len(actions))
	query := store.PermissionsQuery{}
	switch idType {
	case types.TypeUser, types.TypeServiceAccount:
		identifiers, err := s.getUserIdentifiers(ctx, ns, userUID, skipCache)
		if err != nil {
			return nil, fmt.Errorf("could not get user identifiers: %w", err)
		}

		query, err = s.getLegacyUserPermissionQuery(ctx, ns, identifiers, skipCache)
		if err != nil {
			return nil, fmt.Errorf("could not get legacy user permission query: %w", err)
		}
	case types.TypeAnonymous:
		query.Role = s.settings.AnonOrgRole
	case types.TypeRenderService:
		for _, action := range actions {
			scopes, err := s.getRendererPermissions(ctx, action)
			if err != nil {
				return nil, fmt.Errorf("could not get renderer permissions: %w", err)
			}
			if scopes["*"] {
				permissions[action] = []string{"*"}
			}
		}
		return permissions, nil
	default:
		return nil, fmt.Errorf("unsupported identity type: %s", idType)
	}

	for _, action := range actions {
		actionQuery := query
		actionQuery.Action = action
		if s.actionResolver != nil {
			actionQuery.ActionSets = s.actionResolver.ResolveAction(action)
		}

		grants, err := s.permissionStore.GetUserPermissions(ctx, ns, actionQuery)
		if err != nil {
			return nil, fmt.Errorf("could not get user permissions: %w", err)
		}
		// Modern Kubernetes checks normalize scopes. Legacy evaluators need
		// the original strings, including empty scopes on action-only grants.
		for _, grant := range grants {
			permissions[action] = append(permissions[action], grant.Scope)
		}

		if action == folder.ActionFoldersRead {
			sharedWithMeScope := folder.ScopeFoldersProvider.GetResourceScopeUID(folder.SharedWithMeFolderUID)
			permissions[action] = append(permissions[action], sharedWithMeScope)
		}
	}

	return permissions, nil
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

type legacyEvaluationArgs struct {
	permissions       map[string][]string
	hasAnyPermissions bool
	scopeRequest      legacyScopeRequest
}

func (s *Service) prepareLegacyOrgEvaluation(
	ctx context.Context,
	actions []string,
	scopeRequest legacyScopeRequest,
) (legacyEvaluationArgs, error) {
	permissions, err := s.getLegacyIdentityPermissions(
		ctx,
		scopeRequest.namespace,
		scopeRequest.identityType,
		scopeRequest.userUID,
		actions,
		scopeRequest.skipCache,
	)
	if err != nil {
		return legacyEvaluationArgs{}, err
	}

	// The legacy loader adds SharedWithMe for users, service accounts and anonymous
	// identities even without stored grants (legacypermissions/loader.go). Renderers
	// have fixed grants. Their full permission sets are nonempty even when this
	// filtered result is empty.
	return legacyEvaluationArgs{
		permissions:       permissions,
		hasAnyPermissions: true,
		scopeRequest:      scopeRequest,
	}, nil
}

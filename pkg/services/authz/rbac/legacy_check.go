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
) ([]string, bool, error) {
	permissions, hasAnyPermissions, err := s.getLegacyIdentityPermissions(
		ctx,
		ns,
		idType,
		userUID,
		[]string{action},
		skipCache,
	)
	if err != nil {
		return nil, false, fmt.Errorf("could not get legacy identity permissions: %w", err)
	}

	return permissions[action], hasAnyPermissions, nil
}

// getLegacyIdentityPermissions returns grants for the requested actions and whether
// the identity has any effective permissions. The filtered map can be empty even
// though the identity has the SharedWithMe grant or fixed renderer grants.
func (s *Service) getLegacyIdentityPermissions(
	ctx context.Context,
	ns types.NamespaceInfo,
	idType types.IdentityType,
	userUID string,
	actions []string,
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

		if action == folder.ActionFoldersRead {
			sharedWithMeScope := folder.ScopeFoldersProvider.GetResourceScopeUID(folder.SharedWithMeFolderUID)
			permissions[action] = append(permissions[action], sharedWithMeScope)
		}
	}

	// The legacy permission loader adds SharedWithMe for users, service accounts
	// and anonymous identities even without stored grants (legacypermissions/loader.go).
	// Their effective permission set is therefore nonempty, including when this
	// filtered result is empty. No additional permission-existence query is needed.
	return permissions, true, nil
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
	permissions, hasAnyPermissions, err := s.getLegacyIdentityPermissions(
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

	return legacyEvaluationArgs{
		permissions:       permissions,
		hasAnyPermissions: hasAnyPermissions,
		scopeRequest:      scopeRequest,
	}, nil
}

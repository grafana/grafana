package rbac

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
)

// WithLegacyScopeResolvers returns a new service instance that shares existing
// dependencies and live resolver registrations with embedded Access Control.
// Captured Grafana services belong to this process, so callbacks may only serve
// namespaces produced by its namespace mapper. Standalone AuthZ needs its own providers.
func (s *Service) WithLegacyScopeResolvers(
	resolvers *accesscontrol.ScopeResolverRegistry,
	namespace types.NamespaceFormatter,
) *Service {
	service := *s
	service.legacyScopeResolvers = resolvers
	service.legacyScopeNamespace = namespace

	return &service
}

type legacyScopeRequest struct {
	namespace      types.NamespaceInfo
	identityType   types.IdentityType
	userUID        string
	skipCache      bool
	globalIdentity *legacyGlobalIdentity
}

// Evaluate the original expression first. If it denies access, resolve its
// scopes and evaluate again, matching Access Control's two-pass behavior.
func (s *Service) evaluateLegacyWithResolvers(
	ctx context.Context,
	evaluator accesscontrol.Evaluator,
	permissions map[string][]string,
	hasAnyPermissions bool,
	skipScopeResolution bool,
	req legacyScopeRequest,
) (bool, error) {
	if !hasAnyPermissions {
		return false, nil
	}

	if evaluator.Evaluate(permissions) {
		return true, nil
	}

	if skipScopeResolution || !s.legacyScopeResolvers.HasResolvers() {
		return false, nil
	}

	resolved, err := evaluator.MutateScopes(ctx, s.newLegacyScopeMutator(req, permissions))

	switch {
	case errors.Is(err, accesscontrol.ErrResolverNotFound):
		return false, nil
	case err != nil:
		return false, fmt.Errorf("could not evaluate legacy expression: %w", err)
	default:
		return resolved.Evaluate(permissions), nil
	}
}

func (s *Service) validateLegacyScopeNamespace(ns types.NamespaceInfo) error {
	if s.legacyScopeResolvers == nil {
		return nil
	}

	if s.legacyScopeNamespace == nil || s.legacyScopeNamespace(ns.OrgID) != ns.Value {
		return errors.New("namespace does not belong to embedded scope resolvers")
	}

	return nil
}

func (s *Service) newLegacyScopeMutator(
	req legacyScopeRequest,
	permissions map[string][]string,
) accesscontrol.ScopeAttributeMutator {
	// TODO: this will be redeifned in the next follow up PR
	// https://github.com/grafana/identity-access-team/issues/2436
	// Resolve repeated scopes once per check. Results are not reused across
	// requests, avoiding tenant/subject cache keys and invalidation here.
	resolved := make(map[string][]string)
	var requester identity.Requester

	return func(ctx context.Context, scope string) ([]string, error) {
		if err := s.validateLegacyScopeNamespace(req.namespace); err != nil {
			return nil, err
		}

		if scopes, ok := resolved[scope]; ok {
			return slices.Clone(scopes), nil
		}

		resolver, ok := s.legacyScopeResolvers.Get(accesscontrol.ScopePrefix(scope))
		if !ok {
			return nil, accesscontrol.ErrResolverNotFound
		}

		if requester == nil {
			var err error
			requester, err = s.legacyResolverRequester(ctx, req, permissions)
			if err != nil {
				return nil, err
			}
		}

		// The authenticated RPC caller can be a service acting for another user.
		// Resolvers must observe the checked subject, never that caller's privileges.
		ctx = identity.WithRequester(ctx, requester)

		scopes, err := resolver.Resolve(ctx, requester.GetOrgID(), scope)
		if err != nil {
			return nil, fmt.Errorf("could not resolve %v: %w", scope, err)
		}

		resolved[scope] = slices.Clone(scopes)

		return scopes, nil
	}
}

func (s *Service) legacyResolverRequester(
	ctx context.Context,
	req legacyScopeRequest,
	permissions map[string][]string,
) (identity.Requester, error) {
	if req.globalIdentity != nil {
		return s.legacyGlobalResolverRequester(ctx, req, permissions)
	}

	requester := &identity.StaticRequester{
		Type:      req.identityType,
		UserUID:   req.userUID,
		OrgID:     req.namespace.OrgID,
		Namespace: req.namespace.Value,
		CacheKey:  fmt.Sprintf("%s:%s", req.namespace.Value, types.NewTypeID(req.identityType, req.userUID)),
	}

	switch req.identityType {
	case types.TypeUser, types.TypeServiceAccount:
		identifiers, err := s.getUserIdentifiers(ctx, req.namespace, req.userUID, req.skipCache)
		if err != nil {
			return nil, fmt.Errorf("could not get user identifiers: %w", err)
		}

		role, err := s.getUserBasicRoleWithCache(ctx, req.namespace, identifiers, req.skipCache)
		if err != nil {
			return nil, fmt.Errorf("could not get user basic role: %w", err)
		}

		requester.UserID = identifiers.ID
		requester.UserUID = identifiers.UID
		requester.OrgRole = identity.RoleType(role.Role)
		requester.IsGrafanaAdmin = role.IsAdmin
	case types.TypeAnonymous:
		requester.OrgRole = identity.RoleType(s.settings.AnonOrgRole)
	case types.TypeRenderService:
	default:
		return nil, fmt.Errorf("unsupported identity type: %s", req.identityType)
	}

	grants := make(map[string][]string, len(permissions)+1)
	for action, scopes := range permissions {
		grants[action] = slices.Clone(scopes)
	}

	// Library-panel resolution can perform folder visibility checks as the
	// subject. Load that action explicitly instead of fetching a full snapshot.
	//
	// TODO: in the follow-up PRs (of this task https://github.com/grafana/identity-access-team/issues/2436)
	// we will need to address the issue that ALL resolvers load folder.ActionFoldersRead
	// even when the resolver does not need it (f.e. datasources)
	if _, ok := grants[folder.ActionFoldersRead]; !ok {
		scopes, err := s.getLegacyIdentityScopes(
			ctx,
			req.namespace,
			req.identityType,
			req.userUID,
			folder.ActionFoldersRead,
			req.skipCache,
		)
		if err != nil {
			return nil, fmt.Errorf("could not get legacy identity scopes: %w", err)
		}

		if len(scopes) > 0 {
			grants[folder.ActionFoldersRead] = scopes
		}
	}

	requester.Permissions = map[int64]map[string][]string{
		req.namespace.OrgID: grants,
	}

	return requester, nil
}

package rbac

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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
	namespace         types.NamespaceInfo
	identityType      types.IdentityType
	userUID           string
	skipCache         bool
	restrictedActions []string
	globalIdentity    *legacyGlobalIdentity
	internalRequester identity.Requester
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
	loadedActions := make(map[string]bool)
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
		if err := s.loadLegacyResolverPermissions(ctx, req, resolver, requester, loadedActions); err != nil {
			return nil, err
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

func (s *Service) loadLegacyResolverPermissions(
	ctx context.Context,
	req legacyScopeRequest,
	resolver accesscontrol.ScopeAttributeResolver,
	requester identity.Requester,
	loadedActions map[string]bool,
) error {
	// Internal profiles already contain their full grants and have no database
	// subject. Missing actions must remain denied instead of triggering a lookup.
	if req.internalRequester != nil {
		return nil
	}

	dependencies, ok := resolver.(accesscontrol.ScopeResolverPermissionDependencies)
	if !ok {
		return nil
	}

	grants := requester.GetPermissions()
	if req.globalIdentity != nil {
		grants = requester.GetGlobalPermissions()
	}

	for _, action := range dependencies.RequiredActions() {
		if !req.permitsAction(action) {
			continue
		}
		if _, ok := grants[action]; ok || loadedActions[action] {
			continue
		}

		additional, err := s.getLegacyPermissions(ctx, req, []string{action})
		if err != nil {
			return fmt.Errorf("could not get legacy resolver permissions: %w", err)
		}
		if scopes, ok := additional[action]; ok {
			grants[action] = scopes
		}
		// Remember empty lookups separately: adding even a nil scope slice to
		// grants would allow action-only checks for an action the subject lacks.
		loadedActions[action] = true
	}
	return nil
}

func (s *Service) legacyResolverRequester(
	ctx context.Context,
	req legacyScopeRequest,
	permissions map[string][]string,
) (identity.Requester, error) {
	if req.internalRequester != nil {
		return req.internalRequester, nil
	}

	if req.globalIdentity != nil {
		return legacyGlobalResolverRequester(req, permissions), nil
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

	grants := make(map[string][]string, len(permissions))
	for action, scopes := range permissions {
		grants[action] = slices.Clone(scopes)
	}

	requester.Permissions = map[int64]map[string][]string{
		req.namespace.OrgID: grants,
	}

	return requester, nil
}

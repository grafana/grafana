package rbac

import (
	"context"
	"slices"
)

func (r legacyScopeRequest) permitsAction(action string) bool {
	return r.restrictedActions == nil || slices.Contains(r.restrictedActions, action)
}

func (r legacyScopeRequest) filterActions(actions []string) []string {
	if r.restrictedActions == nil {
		return actions
	}

	filtered := make([]string, 0, len(actions))
	for _, action := range actions {
		// An empty action selects all grants in legacy stores; it must not bypass the caller's action limit.
		if action != "" && r.permitsAction(action) {
			filtered = append(filtered, action)
		}
	}

	return filtered
}

func (s *Service) getLegacyPermissions(ctx context.Context, req legacyScopeRequest, actions []string) (map[string][]string, error) {
	actions = req.filterActions(actions)
	if len(actions) == 0 && (req.restrictedActions != nil || req.globalIdentity != nil) {
		return map[string][]string{}, nil
	}

	if req.globalIdentity != nil {
		return s.getLegacyGlobalPermissions(ctx, req.globalIdentity, actions)
	}

	return s.getLegacyIdentityPermissions(ctx, req.namespace, req.identityType, req.userUID, actions, req.skipCache)
}

func (s *Service) prepareLegacyPermissions(ctx context.Context, actions []string, req legacyScopeRequest) (legacyEvaluationArgs, error) {
	if req.restrictedActions != nil && len(req.restrictedActions) == 0 {
		return legacyEvaluationArgs{scopeRequest: req}, nil
	}

	permissions, err := s.getLegacyPermissions(ctx, req, actions)
	if err != nil {
		return legacyEvaluationArgs{}, err
	}

	// A supplied action list comes from a nonempty effective permission map.
	// Without a restriction, implicit grants keep the legacy permission set nonempty.
	return legacyEvaluationArgs{permissions: permissions, hasAnyPermissions: true, scopeRequest: req}, nil
}

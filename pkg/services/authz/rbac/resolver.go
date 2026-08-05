package rbac

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type ScopeResolverFunc func(scope string) (string, error)

func (s *Service) fetchServiceAccounts(ctx context.Context, ns types.NamespaceInfo) (map[int64]string, error) {
	saIDs := make(map[int64]string)
	query := legacy.ListServiceAccountsQuery{}
	for {
		serviceAccounts, err := s.identityStore.ListServiceAccounts(ctx, ns, query)
		if err != nil {
			return nil, fmt.Errorf("could not fetch service accounts: %w", err)
		}
		for _, sa := range serviceAccounts.Items {
			saIDs[sa.ID] = sa.UID
		}
		if serviceAccounts.Continue == 0 {
			break
		}
		query.Pagination.Continue = serviceAccounts.Continue
	}
	return saIDs, nil
}

// Should return an error if we fail to build the resolver.
func (s *Service) newServiceAccountNameResolver(ctx context.Context, ns types.NamespaceInfo) (ScopeResolverFunc, error) {
	return func(scope string) (string, error) {
		saIDs, err := s.fetchServiceAccounts(ctx, ns)
		if err != nil {
			return "", fmt.Errorf("could not build resolver: %w", err)
		}

		serviceAccountIDStr := strings.TrimPrefix(scope, "serviceaccounts:id:")
		if serviceAccountIDStr == "" {
			return "", fmt.Errorf("service account ID is empty")
		}
		if serviceAccountIDStr == "*" {
			return "serviceaccounts:uid:*", nil
		}
		serviceAccountID, err := strconv.ParseInt(serviceAccountIDStr, 10, 64)
		if err != nil {
			return "", fmt.Errorf("invalid service account ID %s: %w", serviceAccountIDStr, err)
		}
		if serviceAccountName, ok := saIDs[serviceAccountID]; ok {
			return "serviceaccounts:uid:" + serviceAccountName, nil
		}
		return "", fmt.Errorf("service account ID %s not found", serviceAccountIDStr)
	}, nil
}

func (s *Service) fetchTeams(ctx context.Context, ns types.NamespaceInfo) (map[int64]string, error) {
	key := teamIDsCacheKey(ns.Value)
	res, err, _ := s.sf.Do(key, func() (any, error) {
		teamIDs := make(map[int64]string)
		query := legacy.ListTeamQuery{}
		for {
			teams, err := s.identityStore.ListTeams(ctx, ns, query)
			if err != nil {
				return nil, fmt.Errorf("could not fetch teams: %w", err)
			}
			for _, team := range teams.Teams {
				teamIDs[team.ID] = team.UID
			}
			if teams.Continue == 0 {
				break
			}
			query.Pagination.Continue = teams.Continue
		}
		return teamIDs, nil
	})
	if err != nil {
		return nil, err
	}
	teamIDs := res.(map[int64]string)
	s.teamIDCache.Set(ctx, key, teamIDs)
	return teamIDs, nil
}

// Should return an error if we fail to build the resolver.
func (s *Service) newTeamNameResolver(ctx context.Context, ns types.NamespaceInfo) (ScopeResolverFunc, error) {
	teamIDs, cacheHit := s.teamIDCache.Get(ctx, teamIDsCacheKey(ns.Value))
	if !cacheHit {
		var err error
		teamIDs, err = s.fetchTeams(ctx, ns)
		if err != nil {
			return nil, fmt.Errorf("could not build resolver: %w", err)
		}
	}

	return func(scope string) (string, error) {
		teamIDStr := strings.TrimPrefix(scope, "teams:id:")
		if teamIDStr == "" {
			return "", fmt.Errorf("team ID is empty")
		}
		if teamIDStr == "*" {
			return "teams:uid:*", nil
		}
		teamID, err := strconv.ParseInt(teamIDStr, 10, 64)
		if err != nil {
			return "", fmt.Errorf("invalid team ID %s: %w", teamIDStr, err)
		}
		if teamName, ok := teamIDs[teamID]; ok {
			return "teams:uid:" + teamName, nil
		}

		// Stale cache recovery: Try to fetch the teams again.
		if cacheHit {
			// Potential future improvement: if multiple threads have the same stale cache,
			// they might refetch teams separately and asynchronously. We could use a more sophisticated
			// approach to avoid this. Like checking if the cache has been updated meanwhile.
			cacheHit = false
			teamIDs, err = s.fetchTeams(ctx, ns)
			if err != nil {
				// Other improvement: Stop the calling loop if we fail to fetch teams.
				return "", err
			}
			if teamName, ok := teamIDs[teamID]; ok {
				return "teams:uid:" + teamName, nil
			}
		}

		return "", fmt.Errorf("team ID %s not found", teamIDStr)
	}, nil
}

func (s *Service) fetchUsers(ctx context.Context, ns types.NamespaceInfo) (map[int64]string, error) {
	userIDs := make(map[int64]string)
	query := legacy.ListUserQuery{}
	for {
		users, err := s.identityStore.ListUsers(ctx, ns, query)
		if err != nil {
			return nil, fmt.Errorf("could not fetch users: %w", err)
		}
		for _, user := range users.Items {
			userIDs[user.ID] = user.UID
		}
		if users.Continue == 0 {
			break
		}
		query.Pagination.Continue = users.Continue
	}
	return userIDs, nil
}

// Should return an error if we fail to build the resolver.
func (s *Service) newUserNameResolver(ctx context.Context, ns types.NamespaceInfo) (ScopeResolverFunc, error) {
	return func(scope string) (string, error) {
		userIDs, err := s.fetchUsers(ctx, ns)
		if err != nil {
			return "", fmt.Errorf("could not build resolver: %w", err)
		}

		userIDStr := strings.TrimPrefix(scope, "users:id:")
		if userIDStr == "" {
			return "", fmt.Errorf("user ID is empty")
		}
		if userIDStr == "*" {
			return "users:uid:*", nil
		}
		userID, err := strconv.ParseInt(userIDStr, 10, 64)
		if err != nil {
			return "", fmt.Errorf("invalid user ID %s: %w", userIDStr, err)
		}
		if userName, ok := userIDs[userID]; ok {
			return "users:uid:" + userName, nil
		}
		return "", fmt.Errorf("user ID %s not found", userIDStr)
	}, nil
}

func permissionsTypeResolverFunc(scope string) (string, error) {
	switch strings.TrimPrefix(scope, "permissions:type:") {
	case "delegate":
		return "*", nil
	case "escalate":
		return "", nil
	default:
		return "", fmt.Errorf("unsupported scope: %s", scope)
	}
}

// delegationImpliesWildcard reports whether a permissions:type:delegate grant
// on the action also implies the wildcard scope. Role management is the only
// family where that holds: holding the delegate scope must allow operating on
// any role or role binding. Expanding it for other actions would turn a
// delegation-only grant into global access to the resource itself.
func delegationImpliesWildcard(action string) bool {
	switch action {
	case "roles:read", "roles:write", "roles:delete",
		"users.roles:read", "users.roles:add", "users.roles:remove":
		return true
	}
	return false
}

func (s *Service) nameResolver(ctx context.Context, ns types.NamespaceInfo, action, scopePrefix string) (ScopeResolverFunc, error) {
	if scopePrefix == "teams:id:" {
		return s.newTeamNameResolver(ctx, ns)
	}

	if scopePrefix == "permissions:type:" {
		if delegationImpliesWildcard(action) {
			return permissionsTypeResolverFunc, nil
		}
		// The literal alone gates delegation checks; deriving a wildcard here
		// would grant the action itself on every resource.
		return nil, nil
	}
	if scopePrefix == "serviceaccounts:id:" {
		return s.newServiceAccountNameResolver(ctx, ns)
	}
	if scopePrefix == "users:id:" {
		return s.newUserNameResolver(ctx, ns)
	}
	// No resolver found for the given scope prefix.
	return nil, nil
}

// resolveScopeMap translates scopes like "teams:id:1" to "teams:uid:t1".
// It assumes only one scope resolver is needed for a given scope map, based on the first valid scope encountered.
// The action the scopes were granted on decides whether permissions:type:delegate expands to the wildcard.
func (s *Service) resolveScopeMap(ctx context.Context, ns types.NamespaceInfo, action string, scopeMap map[string]bool) (map[string]bool, error) {
	var (
		prefix        string
		scopeResolver ScopeResolverFunc
		err           error
	)
	for scope := range scopeMap {
		// Find the resolver based on the first scope with a valid prefix
		if prefix == "" {
			if len(strings.Split(scope, ":")) < 3 {
				// Skip scopes that don't have at least 3 parts (e.g., "*", "teams:*")
				// This is because we expect scopes to be in the format "resource:attribute:value".
				continue
			}

			// Initialize the scope resolver only once
			prefix = accesscontrol.ScopePrefix(scope)
			scopeResolver, err = s.nameResolver(ctx, ns, action, prefix)
			if err != nil {
				s.logger.FromContext(ctx).Error("failed to create scope resolver", "prefix", prefix, "error", err)
				return nil, err
			}
			if scopeResolver == nil {
				break // No resolver found for this prefix
			}
		}

		// Skip scopes that do not have the expected prefix
		if !strings.HasPrefix(scope, prefix) {
			continue
		}
		resolved, err := scopeResolver(scope)
		if err != nil {
			s.logger.FromContext(ctx).Warn("could not resolve scope name", "scope", scope, "error", err)
			continue // Still want to process other scopes even if one fails.
		}
		if resolved != "" {
			scopeMap[resolved] = true
			// Keep permissions:type:* literals alongside their resolved value.
			// delegate resolves to "*" for the roles resource, but the permissions resource
			// skips wildcards (SkipWildcard) to block privilege escalation
			if !strings.HasPrefix(scope, "permissions:type:") {
				delete(scopeMap, scope)
			}
		}
	}
	return scopeMap, nil
}

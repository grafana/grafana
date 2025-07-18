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

func (s *Service) fetchTeams(ctx context.Context, ns types.NamespaceInfo) (map[int64]string, error) {
	key := teamIDsCacheKey(ns.Value)
	res, err, _ := s.sf.Do(key, func() (any, error) {
		teams, err := s.identityStore.ListTeams(ctx, ns, legacy.ListTeamQuery{})
		if err != nil {
			return nil, fmt.Errorf("could not fetch teams: %w", err)
		}
		teamIDs := make(map[int64]string, len(teams.Teams))
		for _, team := range teams.Teams {
			teamIDs[team.ID] = team.UID
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

func (s *Service) nameResolver(ctx context.Context, ns types.NamespaceInfo, scopePrefix string) (ScopeResolverFunc, error) {
	if scopePrefix == "teams:id:" {
		return s.newTeamNameResolver(ctx, ns)
	}
	// No resolver found for the given scope prefix.
	return nil, nil
}

// resolveScopeMap translates scopes like "teams:id:1" to "teams:uid:t1".
// It assumes only one scope resolver is needed for a given scope map, based on the first valid scope encountered.
func (s *Service) resolveScopeMap(ctx context.Context, ns types.NamespaceInfo, scopeMap map[string]bool) (map[string]bool, error) {
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
			scopeResolver, err = s.nameResolver(ctx, ns, prefix)
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
			delete(scopeMap, scope)
		}
	}
	return scopeMap, nil
}

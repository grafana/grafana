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

type ScopeResolverFunc func(id string) (string, error)

func (s *Service) newTeamNameResolver(ctx context.Context, ns types.NamespaceInfo) ScopeResolverFunc {
	key := teamIDsCacheKey(ns.Value)
	teamIDs, cacheHit := s.teamIDCache.Get(ctx, key)
	if !cacheHit {
		res, err, _ := s.sf.Do(key, func() (interface{}, error) {
			teams, err := s.identityStore.ListTeams(ctx, ns, legacy.ListTeamQuery{})
			if err != nil {
				return nil, fmt.Errorf("could not list teams: %w", err)
			}
			teamIDs = make(map[int64]string, len(teams.Teams))
			for _, team := range teams.Teams {
				teamIDs[team.ID] = team.UID
			}
			s.teamIDCache.Set(ctx, teamIDsCacheKey(ns.Value), teamIDs)
			return teamIDs, nil
		})
		if err != nil {
			s.logger.FromContext(ctx).Error("could not list teams", "error", err)
			return func(scope string) (string, error) {
				return "", fmt.Errorf("could not list teams: %w", err)
			}
		}
		teamIDs = res.(map[int64]string)
	}

	return func(scope string) (string, error) {
		id := strings.TrimPrefix(scope, "teams:id:")
		if id == "" {
			return "", fmt.Errorf("team ID is empty")
		}
		if id == "*" {
			return "teams:uid:*", nil
		}
		idInt, err := strconv.ParseInt(id, 10, 64)
		if err != nil {
			return "", fmt.Errorf("invalid team ID %s: %w", id, err)
		}
		if teamName, ok := teamIDs[idInt]; ok {
			return "teams:uid:" + teamName, nil
		}
		// TODO: Fallback to fetching from the database if not found in cache?
		return "", fmt.Errorf("team ID %s not found", id)
	}
}

func (s *Service) nameResolver(ctx context.Context, ns types.NamespaceInfo, scopePrefix string) ScopeResolverFunc {
	if strings.HasPrefix(scopePrefix, "teams:id:") {
		return s.newTeamNameResolver(ctx, ns)
	}
	return nil
}

// resolveScopeMap translates scopes like "teams:id:1" to "teams:uid:t1".
// It assumes only one scope resolver is needed for a given scope map, based on the first valid scope encountered.
func (s *Service) resolveScopeMap(ctx context.Context, ns types.NamespaceInfo, scopeMap map[string]bool) map[string]bool {
	prefix := ""
	var scopeResolver ScopeResolverFunc
	for scope := range scopeMap {
		// Find the resolver based on the first scope with a valid prefix
		if prefix == "" {
			if len(strings.Split(scope, ":")) < 3 {
				// Skip scopes that don't have at least 3 parts (e.g., "*", "teams:*")
				continue
			}
			if strings.HasPrefix(scope, "folders:uid:") {
				// Resources can be stored in folders
				// but we don't want to resolve folder scopes
				continue
			}

			// Initialize the scope resolver only once
			prefix = accesscontrol.ScopePrefix(scope)
			scopeResolver = s.nameResolver(ctx, ns, prefix)
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
			continue
		}
		if resolved != "" {
			scopeMap[resolved] = true
			delete(scopeMap, scope)
		}
	}
	return scopeMap
}

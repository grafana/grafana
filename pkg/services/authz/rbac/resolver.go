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
	teamIDs, ok := s.teamIDCache.Get(ctx, teamIDsCacheKey(ns.Value))
	if !ok {
		// TODO singleflight?
		teams, err := s.identityStore.ListTeams(ctx, ns, legacy.ListTeamQuery{})
		if err != nil {
			return func(id string) (string, error) {
				return "", fmt.Errorf("could not list teams: %w", err)
			}
		}
		teamIDs = make(map[int64]string, len(teams.Teams))
		for _, team := range teams.Teams {
			teamIDs[team.ID] = team.UID
		}
		s.teamIDCache.Set(ctx, teamIDsCacheKey(ns.Value), teamIDs)
	}

	return func(scope string) (string, error) {
		if !strings.HasPrefix(scope, "teams:id:") {
			return "", fmt.Errorf("scope %s is not a team ID", scope)
		}
		id := strings.TrimPrefix(scope, "teams:id:")
		if id == "" {
			return "", fmt.Errorf("team ID is empty")
		}
		if id == "*" {
			return "*", nil
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

func (s *Service) resolveScopeMap(ctx context.Context, ns types.NamespaceInfo, scopeMap map[string]bool) map[string]bool {
	first := true
	var scopeResolver ScopeResolverFunc
	for scope := range scopeMap {
		if len(strings.Split(scope, ":")) < 3 {
			// Skip scopes that don't have at least 3 parts (e.g., "teams:id:123")
			continue
		}
		if strings.HasPrefix(scope, "folders:uid:") {
			// Skip folder scopes, they are already uid based
			continue
		}
		if first {
			// Initialize the scope resolver only once
			first = false
			prefix := accesscontrol.ScopePrefix(scope)
			scopeResolver = s.nameResolver(ctx, ns, prefix)
			if scopeResolver == nil {
				break // No resolver available, skip further resolution
			}
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

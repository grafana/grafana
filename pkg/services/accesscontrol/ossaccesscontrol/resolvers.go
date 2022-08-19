package ossaccesscontrol

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/accesscontrol"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	ttl           = 30 * time.Second
	cleanInterval = 2 * time.Minute
)

func NewResolvers(log log.Logger) Resolvers {
	return Resolvers{
		log:                log,
		cache:              localcache.New(ttl, cleanInterval),
		attributeResolvers: map[string]accesscontrol.ScopeAttributeResolver{},
	}
}

type Resolvers struct {
	log                log.Logger
	cache              *localcache.CacheService
	attributeResolvers map[string]accesscontrol.ScopeAttributeResolver
}

func (s *Resolvers) AddScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
	s.log.Debug("adding scope attribute resolver for '%v'", prefix)
	s.attributeResolvers[prefix] = resolver
}

func (s *Resolvers) GetScopeAttributeMutator(orgID int64) accesscontrol.ScopeAttributeMutator {
	return func(ctx context.Context, scope string) ([]string, error) {
		key := getScopeCacheKey(orgID, scope)
		// Check cache before computing the scope
		if cachedScope, ok := s.cache.Get(key); ok {
			scopes := cachedScope.([]string)
			s.log.Debug("used cache to resolve scope", "scope", scope, "resolved_scopes", scopes)
			return scopes, nil
		}

		prefix := accesscontrol.ScopePrefix(scope)
		if resolver, ok := s.attributeResolvers[prefix]; ok {
			scopes, err := resolver.Resolve(ctx, orgID, scope)
			if err != nil {
				return nil, fmt.Errorf("could not resolve %v: %w", scope, err)
			}
			// Cache result
			s.cache.Set(key, scopes, ttl)
			s.log.Debug("resolved scope", "scope", scope, "resolved_scopes", scopes)
			return scopes, nil
		}
		return []string{scope}, nil
	}
}

// getScopeCacheKey creates an identifier to fetch and store resolution of scopes in the cache
func getScopeCacheKey(orgID int64, scope string) string {
	return fmt.Sprintf("%s-%v", scope, orgID)
}

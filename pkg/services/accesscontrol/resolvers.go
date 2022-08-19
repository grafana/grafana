package accesscontrol

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/user"
)

// ScopeAttributeResolver is used to resolve attributes in scopes to one or more scopes that are
// evaluated by logical or. E.g. "dashboards:id:1" -> "dashboards:uid:test-dashboard" or "folder:uid:test-folder"
type ScopeAttributeResolver interface {
	Resolve(ctx context.Context, orgID int64, scope string) ([]string, error)
}

// ScopeAttributeResolverFunc is an adapter to allow functions to implement ScopeAttributeResolver interface
type ScopeAttributeResolverFunc func(ctx context.Context, orgID int64, scope string) ([]string, error)

func (f ScopeAttributeResolverFunc) Resolve(ctx context.Context, orgID int64, scope string) ([]string, error) {
	return f(ctx, orgID, scope)
}

type ScopeAttributeMutator func(context.Context, string) ([]string, error)

// ScopeKeywordResolver is used to resolve keywords in scopes e.g. "users:self" -> "user:id:1".
// These type of resolvers is used when fetching stored permissions
type ScopeKeywordResolver interface {
	Resolve(ctx context.Context, user *user.SignedInUser) (string, error)
}

// ScopeKeywordResolverFunc is an adapter to allow functions to implement ScopeKeywordResolver interface
type ScopeKeywordResolverFunc func(ctx context.Context, user *user.SignedInUser) (string, error)

func (f ScopeKeywordResolverFunc) Resolve(ctx context.Context, user *user.SignedInUser) (string, error) {
	return f(ctx, user)
}

type ScopeKeywordMutator func(context.Context, string) (string, error)

const (
	ttl           = 30 * time.Second
	cleanInterval = 2 * time.Minute
)

func NewResolvers(log log.Logger) Resolvers {
	return Resolvers{
		log:                log,
		cache:              localcache.New(ttl, cleanInterval),
		attributeResolvers: map[string]ScopeAttributeResolver{},
	}
}

type Resolvers struct {
	log                log.Logger
	cache              *localcache.CacheService
	attributeResolvers map[string]ScopeAttributeResolver
}

func (s *Resolvers) AddScopeAttributeResolver(prefix string, resolver ScopeAttributeResolver) {
	s.log.Debug("adding scope attribute resolver for '%v'", prefix)
	s.attributeResolvers[prefix] = resolver
}

func (s *Resolvers) GetScopeAttributeMutator(orgID int64) ScopeAttributeMutator {
	return func(ctx context.Context, scope string) ([]string, error) {
		key := getScopeCacheKey(orgID, scope)
		// Check cache before computing the scope
		if cachedScope, ok := s.cache.Get(key); ok {
			scopes := cachedScope.([]string)
			s.log.Debug("used cache to resolve scope", "scope", scope, "resolved_scopes", scopes)
			return scopes, nil
		}

		prefix := ScopePrefix(scope)
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

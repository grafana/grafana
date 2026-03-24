package accesscontrol

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
)

// ScopeAttributeResolver is used to resolve attributes in scopes to one or more scopes that are
// evaluated by logical or. E.g. "dashboards:id:1" -> "dashboards:uid:test-dashboard" or "folder:uid:test-folder"
type ScopeAttributeResolver interface {
	Resolve(ctx context.Context, orgID int64, scope string) ([]string, error)
}

type ActionResolver interface {
	// ExpandActionSets takes a set of permissions that might include some action set permissions, and returns a set of permissions with action sets expanded into underlying permissions
	ExpandActionSets(permissions []Permission) []Permission
	// ExpandActionSetsWithFilter works like ExpandActionSets, but it also takes a function for action filtering. When action sets are expanded into the underlying permissions,
	// only those permissions whose action is matched by actionMatcher are included.
	ExpandActionSetsWithFilter(permissions []Permission, actionMatcher func(action string) bool) []Permission
	// ResolveAction returns all action sets that include the given action
	ResolveAction(action string) []string
	// ResolveActionPrefix returns all action sets that include at least one action with the specified prefix
	ResolveActionPrefix(prefix string) []string
}

// ScopeAttributeResolverFunc is an adapter to allow functions to implement ScopeAttributeResolver interface
type ScopeAttributeResolverFunc func(ctx context.Context, orgID int64, scope string) ([]string, error)

func (f ScopeAttributeResolverFunc) Resolve(ctx context.Context, orgID int64, scope string) ([]string, error) {
	return f(ctx, orgID, scope)
}

type ScopeAttributeMutator func(context.Context, string) ([]string, error)

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
	s.log.Debug("Adding scope attribute resolver", "prefix", prefix)
	s.attributeResolvers[prefix] = resolver
}

func (s *Resolvers) GetScopeAttributeMutator(orgID int64) ScopeAttributeMutator {
	return func(ctx context.Context, scope string) ([]string, error) {
		ctx, span := tracer.Start(ctx, "accesscontrol.GetScopeAttributeMutator")
		defer span.End()

		key := getScopeCacheKey(orgID, scope)
		// Check cache before computing the scope
		if cachedScope, ok := s.cache.Get(key); ok {
			scopes := cachedScope.([]string)
			s.log.Debug("Used cache to resolve scope", "scope", scope, "resolved_scopes", scopes)
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
			s.log.Debug("Resolved scope", "scope", scope, "resolved_scopes", scopes)
			return scopes, nil
		}
		return nil, ErrResolverNotFound
	}
}

// getScopeCacheKey creates an identifier to fetch and store resolution of scopes in the cache
func getScopeCacheKey(orgID int64, scope string) string {
	return fmt.Sprintf("%s-%v", scope, orgID)
}

// InvalidateCache removes a scope resolution from the cache
func (s *Resolvers) InvalidateCache(orgID int64, scope string) {
	key := getScopeCacheKey(orgID, scope)
	s.cache.Delete(key)
	s.log.Debug("Invalidated scope cache", "scope", scope, "orgID", orgID)
}

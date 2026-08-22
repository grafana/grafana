package useractions

import (
	"context"
	"fmt"
	"time"

	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
)

const (
	// cacheTTL bounds how long a stale permission set can be served. There is no
	// invalidation hook for permission changes, so a caller that needs to observe
	// its own new grant immediately passes Options.ReloadCache.
	cacheTTL = 30 * time.Second
	// cleanupInterval is how often expired entries are evicted.
	cleanupInterval = time.Minute
)

type cachedProvider struct {
	next  RolePermissionProvider
	cache *localcache.CacheService
}

// NewCachedProvider memoizes the resolved action map per identity and tenant.
// Resolving costs three queries plus a paged team lookup, so an uncached call
// per page load would multiply load on the tenant database.
func NewCachedProvider(next RolePermissionProvider) RolePermissionProvider {
	return &cachedProvider{next: next, cache: localcache.New(cacheTTL, cleanupInterval)}
}

func (p *cachedProvider) ActionsForUser(ctx context.Context, requester identity.Requester, opts Options) (map[string]bool, error) {
	// The namespace is part of the key: the same identity can be resolved
	// against more than one tenant, and each has its own permissions.
	key := k8srequest.NamespaceValue(ctx) + "/" + requester.GetIdentifier()

	if opts.ReloadCache {
		p.cache.ExclusiveDelete(key)
	}

	value, err := p.cache.GetOrExclusiveSet(key, func() (any, error) {
		return p.next.ActionsForUser(ctx, requester, opts)
	}, cacheTTL)
	if err != nil {
		return nil, err
	}

	cached, ok := value.(map[string]bool)
	if !ok {
		return nil, fmt.Errorf("unexpected cached value of type %T", value)
	}

	// Copy so callers cannot mutate the shared cached map.
	actions := make(map[string]bool, len(cached))
	for action := range cached {
		actions[action] = true
	}
	return actions, nil
}

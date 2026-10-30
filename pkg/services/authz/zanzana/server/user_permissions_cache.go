package server

import (
	"context"
	"fmt"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru/v2"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

type permissionPrincipalKey struct{ store, model, principal string }
type permissionPrincipalEntry struct {
	contribution *permissionContribution
	expires      time.Time
}

type permissionPrincipalCache struct {
	mu         sync.Mutex
	entries    *lru.Cache[permissionPrincipalKey, permissionPrincipalEntry]
	flights    singleflight.Group
	generation uint64
}

func (s *Server) principalCache() *permissionPrincipalCache {
	if !s.cfg.CacheSettings.CheckQueryCacheEnabled || s.cfg.CacheSettings.CheckQueryCacheTTL <= 0 || s.cfg.CacheSettings.CheckCacheLimit == 0 {
		return nil
	}
	s.permissionCacheOnce.Do(func() {
		entries, _ := lru.New[permissionPrincipalKey, permissionPrincipalEntry](int(s.cfg.CacheSettings.CheckCacheLimit))
		s.permissionCache = &permissionPrincipalCache{entries: entries}
	})
	return s.permissionCache
}

func (s *Server) cachedPermissionContribution(ctx context.Context, key permissionPrincipalKey, skip bool, load func(context.Context) (*permissionContribution, error)) (*permissionContribution, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	cache := s.principalCache()
	if skip || cache == nil {
		return load(ctx)
	}
	cache.mu.Lock()
	if entry, ok := cache.entries.Get(key); ok && time.Now().Before(entry.expires) {
		cache.mu.Unlock()
		return entry.contribution, nil
	}
	generation := cache.generation
	cache.mu.Unlock()
	flight := fmt.Sprintf("%q/%q/%q/%d", key.store, key.model, key.principal, generation)
	result := cache.flights.DoChan(flight, func() (any, error) {
		cache.mu.Lock()
		if entry, ok := cache.entries.Get(key); ok && time.Now().Before(entry.expires) {
			cache.mu.Unlock()
			return entry.contribution, nil
		}
		cache.mu.Unlock()
		// A canceled waiter must not cancel a load shared by another user's request.
		shared, cancel := context.WithTimeout(context.WithoutCancel(ctx), permissionPrincipalLoadTimeout)
		defer cancel()
		expires := time.Now().Add(s.cfg.CacheSettings.CheckQueryCacheTTL)
		contribution, err := load(shared)
		if err != nil {
			return nil, err
		}
		cache.mu.Lock()
		if cache.generation == generation && time.Now().Before(expires) {
			cache.entries.Add(key, permissionPrincipalEntry{contribution: contribution, expires: expires})
		}
		cache.mu.Unlock()
		return contribution, nil
	})
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case result := <-result:
		if result.Err != nil {
			return nil, result.Err
		}
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		return result.Val.(*permissionContribution), nil
	}
}

func (s *Server) invalidatePermissionPrincipals(store *zanzana.StoreInfo, writes []*openfgav1.TupleKey, deletes []*openfgav1.TupleKeyWithoutCondition) {
	if len(writes) == 0 && len(deletes) == 0 {
		return
	}
	cache := s.principalCache()
	if cache == nil {
		return
	}
	cache.mu.Lock()
	defer cache.mu.Unlock()
	// In-flight reads from before a write may finish afterward; prevent them from
	// repopulating an evicted contribution with an older result.
	cache.generation++
	for _, grant := range writes {
		cache.entries.Remove(permissionPrincipalKey{store.ID, store.ModelID, grant.GetUser()})
	}
	for _, grant := range deletes {
		cache.entries.Remove(permissionPrincipalKey{store.ID, store.ModelID, grant.GetUser()})
	}
}

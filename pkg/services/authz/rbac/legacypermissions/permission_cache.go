package legacypermissions

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	authcache "github.com/grafana/authlib/cache"

	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

// permissionCache stores permission chunks. Locks serialize fills on one
// replica only. Replicas that share a cache can overwrite a newer refresh with
// an older fill; the TTL bounds that staleness, as in the AuthZ RBAC service.
type permissionCache interface {
	get(ctx context.Context, key string) ([]ac.Permission, bool, error)
	set(ctx context.Context, key string, value []ac.Permission, ttl time.Duration) error
	delete(ctx context.Context, key string) error
	lock(key string) (unlock func())
}

// localPermissionCache keeps embedded entries in the process cache that Access
// Control also uses, so its ClearUserPermissionCache calls reach these entries.
type localPermissionCache struct {
	cache *localcache.CacheService
}

func (c localPermissionCache) get(_ context.Context, key string) ([]ac.Permission, bool, error) {
	value, ok := c.cache.Get(key)
	if !ok {
		return nil, false, nil
	}
	permissions, ok := value.([]ac.Permission)
	if !ok {
		return nil, false, fmt.Errorf("unexpected cached permission type %T for key %q", value, key)
	}
	return permissions, true, nil
}

func (c localPermissionCache) set(_ context.Context, key string, value []ac.Permission, ttl time.Duration) error {
	c.cache.Set(key, value, ttl)
	return nil
}

func (c localPermissionCache) delete(_ context.Context, key string) error {
	c.cache.Delete(key)
	return nil
}

func (c localPermissionCache) lock(key string) func() {
	return c.cache.Lock(key)
}

// sharedPermissionCache uses the AuthZ server cache. It is memcached when
// configured, so a refresh on one replica is visible to the other replicas.
type sharedPermissionCache struct {
	cache authcache.Cache
	// Only the per-key locks are used; values are stored in cache.
	locks *localcache.CacheService
}

func newSharedPermissionCache(cache authcache.Cache) sharedPermissionCache {
	return sharedPermissionCache{cache: cache, locks: localcache.New(0, 0)}
}

// cachedPermission stores only the fields that enumeration returns.
type cachedPermission struct {
	Action string `json:"action"`
	Scope  string `json:"scope"`
}

func (c sharedPermissionCache) get(ctx context.Context, key string) ([]ac.Permission, bool, error) {
	data, err := c.cache.Get(ctx, key)
	if errors.Is(err, authcache.ErrNotFound) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("read permission cache key %q: %w", key, err)
	}
	var stored []cachedPermission
	if err := json.Unmarshal(data, &stored); err != nil {
		return nil, false, fmt.Errorf("decode permission cache key %q: %w", key, err)
	}
	permissions := make([]ac.Permission, len(stored))
	for i, p := range stored {
		permissions[i] = ac.Permission{Action: p.Action, Scope: p.Scope}
	}
	return permissions, true, nil
}

func (c sharedPermissionCache) set(ctx context.Context, key string, value []ac.Permission, ttl time.Duration) error {
	stored := make([]cachedPermission, len(value))
	for i, p := range value {
		stored[i] = cachedPermission{Action: p.Action, Scope: p.Scope}
	}
	data, err := json.Marshal(stored)
	if err != nil {
		return fmt.Errorf("encode permission cache key %q: %w", key, err)
	}
	// Memcached expiry has a resolution of one second, and zero means no expiry.
	// Round up so that a sub-second TTL cannot keep an entry forever.
	ttl = time.Duration(math.Ceil(ttl.Seconds())) * time.Second
	if err := c.cache.Set(ctx, key, data, ttl); err != nil {
		return fmt.Errorf("write permission cache key %q: %w", key, err)
	}
	return nil
}

func (c sharedPermissionCache) delete(ctx context.Context, key string) error {
	if err := c.cache.Delete(ctx, key); err != nil {
		return fmt.Errorf("delete permission cache key %q: %w", key, err)
	}
	return nil
}

func (c sharedPermissionCache) lock(key string) func() {
	return c.locks.Lock(key)
}

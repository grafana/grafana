package rbac

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/grafana/authlib/cache"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

func userIdentifierCacheKey(namespace, userUID string) string {
	return namespace + ".uid_" + userUID
}

func userIdentifierCacheKeyById(namespace, ID string) string {
	return namespace + ".id_" + ID
}

func anonymousPermCacheKey(namespace, action string) string {
	return namespace + ".perm_anonymous_" + action
}

func userPermCacheKey(namespace, userUID, action string) string {
	return namespace + ".perm_" + userUID + "_" + action
}

func userPermDenialCacheKey(namespace, userUID, action, name, parent string) string {
	return namespace + ".perm_" + userUID + "_" + action + "_" + name + "_" + parent
}

func userBasicRoleCacheKey(namespace, userUID string) string {
	return namespace + ".basic_role_" + userUID
}

func userTeamCacheKey(namespace, userUID string) string {
	return namespace + ".team_" + userUID
}

func folderCacheKey(namespace string) string {
	return namespace + ".folders"
}

func teamIDsCacheKey(namespace string) string {
	return namespace + ".teams"
}

type cacheWrap[T any] interface {
	Get(ctx context.Context, key string) (T, bool)
	Set(ctx context.Context, key string, value T)
}
type localEntry[T any] struct {
	value     T
	expiresAt time.Time
}

type cacheWrapImpl[T any] struct {
	cache  cache.Cache
	logger log.Logger
	tracer tracing.Tracer
	ttl    time.Duration

	// When localTTL > 0 an in-memory L1 layer sits in front of the remote
	// cache to avoid round-trips and JSON deserialization on hot paths.
	localTTL time.Duration
	mu       sync.RWMutex
	local    map[string]localEntry[T]
}

// newCacheWrap creates a typed cache around the authlib Cache.
// An optional localTTL enables an in-memory L1 layer when the backing cache
// is remote (e.g. memcached); set to 0 (or omit) to disable.
func newCacheWrap[T any](cache cache.Cache, logger log.Logger, tracer tracing.Tracer, ttl time.Duration, localTTL ...time.Duration) cacheWrap[T] {
	if ttl == 0 {
		logger.Info("cache ttl is 0, using noop cache")
		return &noopCache[T]{}
	}
	w := &cacheWrapImpl[T]{cache: cache, logger: logger, tracer: tracer, ttl: ttl}
	if len(localTTL) > 0 && localTTL[0] > 0 {
		w.localTTL = localTTL[0]
		w.local = make(map[string]localEntry[T])
	}
	return w
}

func (c *cacheWrapImpl[T]) Get(ctx context.Context, key string) (T, bool) {
	if c.localTTL > 0 {
		c.mu.RLock()
		entry, ok := c.local[key]
		c.mu.RUnlock()
		if ok {
			if time.Now().Before(entry.expiresAt) {
				return entry.value, true
			}
			c.mu.Lock()
			delete(c.local, key)
			c.mu.Unlock()
		}
	}

	ctx, span := c.tracer.Start(ctx, "cacheWrap.Get")
	defer span.End()
	span.SetAttributes(attribute.Bool("hit", false))
	logger := c.logger.FromContext(ctx)

	var value T
	data, err := c.cache.Get(ctx, key)
	if err != nil {
		if !errors.Is(err, cache.ErrNotFound) {
			logger.Warn("failed to get from cache", "key", key, "error", err)
		}
		return value, false
	}

	err = json.Unmarshal(data, &value)
	if err != nil {
		logger.Warn("failed to unmarshal from cache", "key", key, "error", err)
		return value, false
	}

	span.SetAttributes(attribute.Bool("hit", true))

	if c.localTTL > 0 {
		c.mu.Lock()
		c.local[key] = localEntry[T]{value: value, expiresAt: time.Now().Add(c.localTTL)}
		c.mu.Unlock()
	}

	return value, true
}

func (c *cacheWrapImpl[T]) Set(ctx context.Context, key string, value T) {
	if c.localTTL > 0 {
		c.mu.Lock()
		c.local[key] = localEntry[T]{value: value, expiresAt: time.Now().Add(c.localTTL)}
		c.mu.Unlock()
	}

	ctx, span := c.tracer.Start(ctx, "cacheWrap.Set")
	defer span.End()
	logger := c.logger.FromContext(ctx)

	data, err := json.Marshal(value)
	if err != nil {
		logger.Warn("failed to marshal to cache", "key", key, "error", err)
		return
	}

	err = c.cache.Set(ctx, key, data, c.ttl)
	if err != nil {
		logger.Warn("failed to set to cache", "key", key, "error", err)
	}
}

type noopCache[T any] struct{}

func (lc *noopCache[T]) Get(ctx context.Context, key string) (T, bool) {
	var value T
	return value, false
}

func (lc *noopCache[T]) Set(ctx context.Context, key string, value T) {
	// no-op
}

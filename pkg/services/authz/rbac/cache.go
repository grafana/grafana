package rbac

import (
	"context"
	"encoding/json"
	"errors"
	"sync/atomic"
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

// rbacCacheState holds the cache skip state for a request using atomic operations for thread safety
type rbacCacheState struct {
	skip atomic.Bool
}

// cacheSkipKey is used to store rbacCacheState in context
type cacheSkipKey struct{}

// Global key instance to avoid allocations on each context lookup
var globalSkipKey = cacheSkipKey{}

// shouldSkipCache returns true if cache operations should be skipped for this request.
// Optimized for high-performance with fast path atomic read (~5ns).
func shouldSkipCache(ctx context.Context) bool {
	if state, ok := ctx.Value(globalSkipKey).(*rbacCacheState); ok {
		return state.skip.Load()
	}
	return false
}

// markCacheSkip marks the context to skip cache operations for the rest of the request.
// Only allocates once per request on first cache error.
func markCacheSkip(ctx context.Context) {
	if state, ok := ctx.Value(globalSkipKey).(*rbacCacheState); ok {
		state.skip.Store(true) // Already have state, just flip atomic flag
	}

	// First error in request - create state (allocates once per request with cache errors)
	state := &rbacCacheState{}
	state.skip.Store(true)
}

type cacheWrap[T any] interface {
	Get(ctx context.Context, key string) (T, bool)
	Set(ctx context.Context, key string, value T)
}

type cacheWrapImpl[T any] struct {
	cache  cache.Cache
	logger log.Logger
	tracer tracing.Tracer
	ttl    time.Duration
}

// cacheWrap is a wrapper around the authlib Cache that provides typed Get and Set methods
// it handles encoding/decoding for a specific type.
func newCacheWrap[T any](cache cache.Cache, logger log.Logger, tracer tracing.Tracer, ttl time.Duration) cacheWrap[T] {
	if ttl == 0 {
		logger.Info("cache ttl is 0, using noop cache")
		return &noopCache[T]{}
	}
	return &cacheWrapImpl[T]{cache: cache, logger: logger, tracer: tracer, ttl: ttl}
}

func (c *cacheWrapImpl[T]) Get(ctx context.Context, key string) (T, bool) {
	ctx, span := c.tracer.Start(ctx, "cacheWrap.Get")
	defer span.End()
	span.SetAttributes(attribute.Bool("hit", false))
	logger := c.logger.FromContext(ctx)

	var value T

	// Skip cache if marked for skip (fast atomic check ~5ns)
	if shouldSkipCache(ctx) {
		span.SetAttributes(attribute.Bool("skipped", true))
		return value, false
	}

	data, err := c.cache.Get(ctx, key)
	if err != nil {
		if !errors.Is(err, cache.ErrNotFound) {
			logger.Warn("failed to get from cache", "key", key, "error", err)
			// Mark context to skip subsequent cache operations (minimal allocation)
			markCacheSkip(ctx)
		}
		return value, false
	}

	err = json.Unmarshal(data, &value)
	if err != nil {
		logger.Warn("failed to unmarshal from cache", "key", key, "error", err)
		// Mark context to skip subsequent cache operations
		markCacheSkip(ctx)
		return value, false
	}

	span.SetAttributes(attribute.Bool("hit", true))
	return value, true
}

func (c *cacheWrapImpl[T]) Set(ctx context.Context, key string, value T) {
	ctx, span := c.tracer.Start(ctx, "cacheWrap.Set")
	defer span.End()
	logger := c.logger.FromContext(ctx)

	// Skip cache if marked for skip (fast atomic check ~5ns)
	if shouldSkipCache(ctx) {
		span.SetAttributes(attribute.Bool("skipped", true))
		return
	}

	data, err := json.Marshal(value)
	if err != nil {
		logger.Warn("failed to marshal to cache", "key", key, "error", err)
		// Mark context to skip subsequent cache operations
		markCacheSkip(ctx)
		return
	}

	err = c.cache.Set(ctx, key, data, c.ttl)
	if err != nil {
		logger.Warn("failed to set to cache", "key", key, "error", err)
		// Mark context to skip subsequent cache operations
		markCacheSkip(ctx)
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

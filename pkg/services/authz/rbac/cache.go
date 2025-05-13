package rbac

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/grafana/authlib/cache"

	"github.com/grafana/grafana/pkg/infra/log"
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

type cacheWrap[T any] interface {
	Get(ctx context.Context, key string) (T, bool)
	Set(ctx context.Context, key string, value T)
}
type cacheWrapImpl[T any] struct {
	cache  cache.Cache
	logger log.Logger
	ttl    time.Duration
}

// cacheWrap is a wrapper around the authlib Cache that provides typed Get and Set methods
// it handles encoding/decoding for a specific type.
func newCacheWrap[T any](cache cache.Cache, logger log.Logger, ttl time.Duration) cacheWrap[T] {
	if ttl == 0 {
		logger.Info("cache ttl is 0, using noop cache")
		return &noopCache[T]{}
	}
	return &cacheWrapImpl[T]{cache: cache, logger: logger, ttl: ttl}
}

func (c *cacheWrapImpl[T]) Get(ctx context.Context, key string) (T, bool) {
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

	return value, true
}

func (c *cacheWrapImpl[T]) Set(ctx context.Context, key string, value T) {
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

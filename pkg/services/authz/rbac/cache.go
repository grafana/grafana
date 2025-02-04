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

func userBasicRoleCacheKey(namespace, userUID string) string {
	return namespace + ".basic_role_" + userUID
}

func userTeamCacheKey(namespace, userUID string) string {
	return namespace + ".team_" + userUID
}

func folderCacheKey(namespace string) string {
	return namespace + ".folders"
}

type cacheWrap[T any] struct {
	cache  cache.Cache
	logger log.Logger
	ttl    time.Duration
}

// cacheWrap is a wrapper around the authlib Cache that provides typed Get and Set methods
// it handles encoding/decoding for a specific type.
func newCacheWrap[T any](cache cache.Cache, logger log.Logger, ttl time.Duration) *cacheWrap[T] {
	return &cacheWrap[T]{cache: cache, logger: logger, ttl: ttl}
}

func (c *cacheWrap[T]) Get(ctx context.Context, key string) (T, bool) {
	var value T
	data, err := c.cache.Get(ctx, key)
	if err != nil {
		if !errors.Is(err, cache.ErrNotFound) {
			c.logger.Warn("failed to get from cache", "key", key, "error", err)
		}
		return value, false
	}

	err = json.Unmarshal(data, &value)
	if err != nil {
		c.logger.Warn("failed to unmarshal from cache", "key", key, "error", err)
		return value, false
	}

	return value, true
}

func (c *cacheWrap[T]) Set(ctx context.Context, key string, value T) {
	data, err := json.Marshal(value)
	if err != nil {
		c.logger.Warn("failed to marshal to cache", "key", key, "error", err)
		return
	}

	err = c.cache.Set(ctx, key, data, c.ttl)
	if err != nil {
		c.logger.Warn("failed to set to cache", "key", key, "error", err)
	}
}

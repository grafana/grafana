package server

import (
	"time"

	"github.com/grafana/grafana/pkg/infra/localcache"
)

const (
	cacheTTL             = 1 * time.Minute
	cacheCleanupInterval = 5 * time.Minute
)

func newCache[T any]() *cache[T] {
	return &cache[T]{inner: localcache.New(cacheTTL, cacheCleanupInterval)}
}

type cache[T any] struct {
	inner *localcache.CacheService
}

func (c *cache[T]) Get(key string) (T, bool) {
	val, ok := c.inner.Get(key)
	if !ok {
		var zero T
		return zero, false
	}

	return val.(T), true
}

func (c *cache[T]) Set(key string, val T) {
	c.inner.Set(key, val, cacheTTL)
}

func (c *cache[T]) Delete(key string) {
	c.inner.Delete(key)
}

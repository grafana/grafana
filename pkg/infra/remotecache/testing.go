package remotecache

import (
	"context"
	"time"

	gocache "github.com/patrickmn/go-cache"
)

// NewTestCache keeps cache-dependent tests independent of SQL.
func NewTestCache() *RemoteCache {
	// Get checks expiration, so tests need no cleanup goroutine.
	return &RemoteCache{client: &testCacheStorage{cache: gocache.New(defaultMaxCacheExpiration, 0)}}
}

type testCacheStorage struct {
	cache *gocache.Cache
}

func (s *testCacheStorage) Get(_ context.Context, key string) ([]byte, error) {
	value, ok := s.cache.Get(key)
	if !ok {
		return nil, ErrCacheItemNotFound
	}
	return value.([]byte), nil
}

func (s *testCacheStorage) Set(_ context.Context, key string, value []byte, expire time.Duration) error {
	s.cache.Set(key, value, expire)
	return nil
}

func (s *testCacheStorage) Delete(_ context.Context, key string) error {
	s.cache.Delete(key)
	return nil
}

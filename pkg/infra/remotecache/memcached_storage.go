package remotecache

import (
	"context"
	"errors"
	"time"

	"github.com/bradfitz/gomemcache/memcache"

	"github.com/grafana/grafana/pkg/setting"
)

const memcachedCacheType = "memcached"

var ErrNotImplemented = errors.New("not implemented")

type memcachedStorage struct {
	c *memcache.Client
}

func newMemcachedStorage(opts *setting.RemoteCacheSettings) *memcachedStorage {
	return &memcachedStorage{
		c: memcache.New(opts.ConnStr),
	}
}

func newItem(sid string, data []byte, expire int32) *memcache.Item {
	return &memcache.Item{
		Key:        sid,
		Value:      data,
		Expiration: expire,
	}
}

// SetByteArray stores an byte array in the cache
func (s *memcachedStorage) Set(ctx context.Context, key string, data []byte, expires time.Duration) error {
	var expiresInSeconds int64
	if expires != 0 {
		expiresInSeconds = int64(expires) / int64(time.Second)
	}

	memcachedItem := newItem(key, data, int32(expiresInSeconds))
	return s.c.Set(memcachedItem)
}

// GetByteArray returns the cached value as an byte array
func (s *memcachedStorage) Get(ctx context.Context, key string) ([]byte, error) {
	memcachedItem, err := s.c.Get(key)
	if errors.Is(err, memcache.ErrCacheMiss) {
		return nil, ErrCacheItemNotFound
	}

	if err != nil {
		return nil, err
	}

	return memcachedItem.Value, nil
}

func (s *memcachedStorage) MGet(ctx context.Context, keys ...string) ([][]byte, error) {
	if len(keys) == 0 {
		return [][]byte{}, nil
	}

	items, err := s.c.GetMulti(keys)
	if err != nil {
		return nil, err
	}

	// Build result in the same order as keys
	result := make([][]byte, len(keys))
	for i, key := range keys {
		if item, ok := items[key]; ok {
			result[i] = item.Value
		} else {
			result[i] = nil
		}
	}

	return result, nil
}

// Delete delete a key from the cache
func (s *memcachedStorage) Delete(ctx context.Context, key string) error {
	return s.c.Delete(key)
}

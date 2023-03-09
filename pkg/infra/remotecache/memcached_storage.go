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
	c     *memcache.Client
	codec codec
}

func newMemcachedStorage(opts *setting.RemoteCacheOptions, codec codec) *memcachedStorage {
	return &memcachedStorage{
		c:     memcache.New(opts.ConnStr),
		codec: codec,
	}
}

func newItem(sid string, data []byte, expire int32) *memcache.Item {
	return &memcache.Item{
		Key:        sid,
		Value:      data,
		Expiration: expire,
	}
}

// Set sets value to given key in the cache.
func (s *memcachedStorage) Set(ctx context.Context, key string, val interface{}, expires time.Duration) error {
	item := &cachedItem{Val: val}
	bytes, err := s.codec.Encode(ctx, item)
	if err != nil {
		return err
	}

	return s.SetByteArray(ctx, key, bytes, expires)
}

// SetByteArray stores an byte array in the cache
func (s *memcachedStorage) SetByteArray(ctx context.Context, key string, data []byte, expires time.Duration) error {
	var expiresInSeconds int64
	if expires != 0 {
		expiresInSeconds = int64(expires) / int64(time.Second)
	}

	memcachedItem := newItem(key, data, int32(expiresInSeconds))
	return s.c.Set(memcachedItem)
}

// Get gets value by given key in the cache.
func (s *memcachedStorage) Get(ctx context.Context, key string) (interface{}, error) {
	bytes, err := s.GetByteArray(ctx, key)
	if err != nil {
		return nil, err
	}

	item := &cachedItem{}
	err = s.codec.Decode(ctx, bytes, item)
	if err != nil {
		return nil, err
	}

	return item.Val, nil
}

// GetByteArray returns the cached value as an byte array
func (s *memcachedStorage) GetByteArray(ctx context.Context, key string) ([]byte, error) {
	memcachedItem, err := s.c.Get(key)
	if errors.Is(err, memcache.ErrCacheMiss) {
		return nil, ErrCacheItemNotFound
	}

	if err != nil {
		return nil, err
	}

	return memcachedItem.Value, nil
}

func (s *memcachedStorage) Count(ctx context.Context, prefix string) (int64, error) {
	return 0, ErrNotImplemented
}

// Delete delete a key from the cache
func (s *memcachedStorage) Delete(ctx context.Context, key string) error {
	return s.c.Delete(key)
}

package distcache

import (
	"time"

	"github.com/bradfitz/gomemcache/memcache"
)

type memcacheStorage struct {
	c *memcache.Client
}

func newMemcacheStorage(connStr string) *memcacheStorage {
	return &memcacheStorage{
		c: memcache.New(connStr),
	}
}

func newItem(sid string, data []byte, expire int32) *memcache.Item {
	return &memcache.Item{
		Key:        sid,
		Value:      data,
		Expiration: expire,
	}
}

// Put sets value to given key in the cache.
func (s *memcacheStorage) Put(key string, val interface{}, expires time.Duration) error {
	item := &cachedItem{Val: val}

	bytes, err := encodeGob(item)
	if err != nil {
		return err
	}

	memcacheItem := newItem(key, bytes, int32(expires))

	return s.c.Set(memcacheItem)
}

// Get gets value by given key in the cache.
func (s *memcacheStorage) Get(key string) (interface{}, error) {
	i, err := s.c.Get(key)

	if err != nil && err.Error() == "memcache: cache miss" {
		return nil, ErrCacheItemNotFound
	}

	if err != nil {
		return nil, err
	}

	item := &cachedItem{}

	err = decodeGob(i.Value, item)
	if err != nil {
		return nil, err
	}

	return item.Val, nil
}

// Delete delete a key from the cache
func (s *memcacheStorage) Delete(key string) error {
	return s.c.Delete(key)
}

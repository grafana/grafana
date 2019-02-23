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

func NewItem(sid string, data []byte, expire int32) *memcache.Item {
	return &memcache.Item{
		Key:        sid,
		Value:      data,
		Expiration: expire,
	}
}

// Set sets value to given key in the cache.
func (s *memcacheStorage) Put(key string, val interface{}, expires time.Duration) error {
	item := &Item{Val: val}

	bytes, err := EncodeGob(item)
	if err != nil {
		return err
	}

	memcacheItem := NewItem(key, bytes, int32(expires))

	s.c.Add(memcacheItem)
	return nil
}

// Get gets value by given key in the cache.
func (s *memcacheStorage) Get(key string) (interface{}, error) {
	i, err := s.c.Get(key)
	if err != nil {
		return nil, err
	}

	item := &Item{}

	err = DecodeGob(i.Value, item)
	if err != nil {
		return nil, err
	}

	return item.Val, nil
}

// Delete delete a key from the cache
func (s *memcacheStorage) Delete(key string) error {
	return s.c.Delete(key)
}

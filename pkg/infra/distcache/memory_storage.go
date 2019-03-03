package distcache

import (
	"time"

	gocache "github.com/patrickmn/go-cache"
)

type memoryStorage struct {
	c *gocache.Cache
}

func newMemoryStorage() *memoryStorage {
	return &memoryStorage{
		c: gocache.New(time.Minute*30, time.Minute*30),
	}
}

func (s *memoryStorage) Put(key string, val interface{}, expires time.Duration) error {
	return s.c.Add(key, val, expires)
}

func (s *memoryStorage) Get(key string) (interface{}, error) {
	val, exist := s.c.Get(key)
	if !exist {
		return nil, ErrCacheItemNotFound
	}

	return val, nil
}

func (s *memoryStorage) Delete(key string) error {
	s.c.Delete(key)
	return nil
}

package distcache

import (
	"time"

	redis "gopkg.in/redis.v2"
)

type redisStorage struct {
	c *redis.Client
}

func newRedisStorage(c *redis.Client) *redisStorage {
	return &redisStorage{c: c}
}

// Set sets value to given key in session.
func (s *redisStorage) Put(key string, val interface{}, expires time.Duration) error {
	item := &cachedItem{Val: val}
	value, err := encodeGob(item)
	if err != nil {
		return err
	}

	var status *redis.StatusCmd
	if expires == 0 {
		status = s.c.Set(key, string(value))
	} else {
		status = s.c.SetEx(key, expires, string(value))
	}

	return status.Err()
}

// Get gets value by given key in session.
func (s *redisStorage) Get(key string) (interface{}, error) {
	v := s.c.Get(key)

	item := &cachedItem{}
	err := decodeGob([]byte(v.Val()), item)

	if err == nil {
		return item.Val, nil
	}

	if err.Error() == "EOF" {
		return nil, ErrCacheItemNotFound
	}

	if err != nil {
		return nil, err
	}

	return item.Val, nil
}

// Delete delete a key from session.
func (s *redisStorage) Delete(key string) error {
	cmd := s.c.Del(key)
	return cmd.Err()
}

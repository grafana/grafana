package remotecache

import (
	"time"

	"github.com/grafana/grafana/pkg/setting"
	redis "gopkg.in/redis.v2"
)

const redisCacheType = "redis"

type redisStorage struct {
	c *redis.Client
}

func newRedisStorage(opts *setting.RemoteCacheOptions) *redisStorage {
	opt := &redis.Options{
		Network: "tcp",
		Addr:    opts.ConnStr,
	}
	return &redisStorage{c: redis.NewClient(opt)}
}

// Set sets value to given key in session.
func (s *redisStorage) Set(key string, val interface{}, expires time.Duration) error {
	item := &cachedItem{Val: val}
	value, err := encodeGob(item)
	if err != nil {
		return err
	}

	status := s.c.SetEx(key, expires, string(value))
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

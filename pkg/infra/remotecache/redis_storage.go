package remotecache

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/setting"
	redis "gopkg.in/redis.v2"
)

const redisCacheType = "redis"

type redisStorage struct {
	c *redis.Client
}

// parseRedisConnStr parses k=v pairs in csv and builds a redis Options object
func parseRedisConnStr(connStr string) (*redis.Options, error) {
	keyValueCSV := strings.Split(connStr, ",")
	options := &redis.Options{Network: "tcp"}
	for _, rawKeyValue := range keyValueCSV {
		keyValueTuple := strings.Split(rawKeyValue, "=")
		if len(keyValueTuple) != 2 {
			return nil, fmt.Errorf("incorrect redis connection string format detected for '%s', format is key=value,key=value", rawKeyValue)
		}
		switch keyValueTuple[0] {
		case "addr":
			options.Addr = keyValueTuple[1]
		//TODO db, password, pool size
		default:
			return nil, fmt.Errorf("unrecorgnized option '%v' in redis connection string", keyValueTuple[0])
		}
	}
	return options, nil
}

func newRedisStorage(opts *setting.RemoteCacheOptions) (*redisStorage, error) {
	opt, err := parseRedisConnStr(opts.ConnStr)
	if err != nil {
		return nil, err
	}
	return &redisStorage{c: redis.NewClient(opt)}, nil
}

// Set sets value to given key in session.
func (s *redisStorage) Set(key string, val interface{}, expires time.Duration) error {
	item := &cachedItem{Val: val}
	value, err := encodeGob(item)
	if err != nil {
		return err
	}
	status := s.c.SetEx(key, -expires, string(value))
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
	return nil, err
}

// Delete delete a key from session.
func (s *redisStorage) Delete(key string) error {
	cmd := s.c.Del(key)
	return cmd.Err()
}

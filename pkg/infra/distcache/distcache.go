package distcache

import (
	"bytes"
	"encoding/gob"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	redis "gopkg.in/redis.v2"

	"github.com/grafana/grafana/pkg/registry"
)

var (
	ErrCacheItemNotFound = errors.New("cache item not found")
)

func init() {
	registry.RegisterService(&DistributedCache{})
}

// Init initializes the service
func (ds *DistributedCache) Init() error {
	ds.log = log.New("distributed.cache")

	ds.Client = createClient(CacheOpts{}, ds.SQLStore)

	return nil
}

type CacheOpts struct {
	name string
}

func createClient(opts CacheOpts, sqlstore *sqlstore.SqlStore) cacheStorage {
	if opts.name == "redis" {
		opt := &redis.Options{
			Network: "tcp",
			Addr:    "localhost:6379",
		}

		return newRedisStorage(redis.NewClient(opt))
	}

	if opts.name == "memcache" {
		return newMemcacheStorage("localhost:11211")
	}

	if opts.name == "memory" {
		return newMemoryStorage()
	}

	return newDatabaseCache(sqlstore)
}

// DistributedCache allows Grafana to cache data outside its own process
type DistributedCache struct {
	log      log.Logger
	Client   cacheStorage
	SQLStore *sqlstore.SqlStore `inject:""`
}

type cachedItem struct {
	Val interface{}
}

func encodeGob(item *cachedItem) ([]byte, error) {
	buf := bytes.NewBuffer(nil)
	err := gob.NewEncoder(buf).Encode(item)
	return buf.Bytes(), err
}

func decodeGob(data []byte, out *cachedItem) error {
	buf := bytes.NewBuffer(data)
	return gob.NewDecoder(buf).Decode(&out)
}

type cacheStorage interface {
	// Get reads object from Cache
	Get(key string) (interface{}, error)

	// Puts an object into the cache
	Put(key string, value interface{}, expire time.Duration) error

	// Delete object from cache
	Delete(key string) error
}

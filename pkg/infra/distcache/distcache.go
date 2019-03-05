package distcache

import (
	"bytes"
	"encoding/gob"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"

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

	ds.Client = createClient(ds.Cfg.CacheOptions, ds.SQLStore)

	return nil
}

func createClient(opts *setting.CacheOpts, sqlstore *sqlstore.SqlStore) cacheStorage {
	if opts.Name == "redis" {
		return newRedisStorage(opts)
	}

	if opts.Name == "memcache" {
		return newMemcacheStorage(opts)
	}

	return newDatabaseCache(sqlstore)
}

// DistributedCache allows Grafana to cache data outside its own process
type DistributedCache struct {
	log      log.Logger
	Client   cacheStorage
	SQLStore *sqlstore.SqlStore `inject:""`
	Cfg      *setting.Cfg       `inject:""`
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

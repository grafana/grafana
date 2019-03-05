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

func createClient(opts *setting.CacheOpts, sqlstore *sqlstore.SqlStore) CacheStorage {
	if opts.Name == "redis" {
		return newRedisStorage(opts)
	}

	if opts.Name == "memcached" {
		return newMemcachedStorage(opts)
	}

	return newDatabaseCache(sqlstore)
}

// DistributedCache allows Grafana to cache data outside its own process
type DistributedCache struct {
	log      log.Logger
	Client   CacheStorage
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

// CacheStorage allows the caller to set, get and delete items in the cache.
// Cached items are stored as byte arrays and marshalled using "encoding/gob"
// so any struct added to the cache needs to be registred with `gob.Register`
// ex `gob.Register(CacheableStruct{})``
type CacheStorage interface {
	// Get reads object from Cache
	Get(key string) (interface{}, error)

	// Set sets an object into the cache
	Set(key string, value interface{}, expire time.Duration) error

	// Delete object from cache
	Delete(key string) error
}

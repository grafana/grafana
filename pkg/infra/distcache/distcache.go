package distcache

import (
	"bytes"
	"context"
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

// CacheStorage allows the caller to set, get and delete items in the cache.
// Cached items are stored as byte arrays and marshalled using "encoding/gob"
// so any struct added to the cache needs to be registred with `distcache.Register`
// ex `distcache.Register(CacheableStruct{})``
type CacheStorage interface {
	// Get reads object from Cache
	Get(key string) (interface{}, error)

	// Set sets an object into the cache
	Set(key string, value interface{}, expire time.Duration) error

	// Delete object from cache
	Delete(key string) error
}

// DistributedCache allows Grafana to cache data outside its own process
type DistributedCache struct {
	log      log.Logger
	Client   CacheStorage
	SQLStore *sqlstore.SqlStore `inject:""`
	Cfg      *setting.Cfg       `inject:""`
}

// Init initializes the service
func (ds *DistributedCache) Init() error {
	ds.log = log.New("distributed.cache")

	ds.Client = createClient(ds.Cfg.CacheOptions, ds.SQLStore)

	return nil
}

func (ds *DistributedCache) Run(ctx context.Context) error {
	backgroundjob, ok := ds.Client.(registry.BackgroundService)
	if ok {
		return backgroundjob.Run(ctx)
	}

	<-ctx.Done()
	return ctx.Err()
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

// Register records a type, identified by a value for that type, under its
// internal type name. That name will identify the concrete type of a value
// sent or received as an interface variable. Only types that will be
// transferred as implementations of interface values need to be registered.
// Expecting to be used only during initialization, it panics if the mapping
// between types and names is not a bijection.
func Register(value interface{}) {
	gob.Register(value)
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

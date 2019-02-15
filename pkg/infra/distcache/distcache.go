package distcache

import (
	"bytes"
	"encoding/gob"
	"errors"

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

	ds.Client = createClient(CacheOpts{}, ds.SQLStore)

	return nil
}

type CacheOpts struct {
	name string
}

func createClient(opts CacheOpts, sqlstore *sqlstore.SqlStore) cacheStorage {
	if opts.name == "redis" {
		return nil
	}

	if opts.name == "memcache" {
		return nil
	}

	if opts.name == "memory" {
		return nil
	}

	return &databaseCache{SQLStore: sqlstore}
}

// DistributedCache allows Grafana to cache data outside its own process
type DistributedCache struct {
	log      log.Logger
	Client   cacheStorage
	SQLStore *sqlstore.SqlStore `inject:""`
}

type Item struct {
	Val     interface{}
	Created int64
	Expire  int64
}

func EncodeGob(item *Item) ([]byte, error) {
	buf := bytes.NewBuffer(nil)
	err := gob.NewEncoder(buf).Encode(item)
	return buf.Bytes(), err
}

func DecodeGob(data []byte, out *Item) error {
	buf := bytes.NewBuffer(data)
	return gob.NewDecoder(buf).Decode(&out)
}

type cacheStorage interface {
	// Get reads object from Cache
	Get(key string) (interface{}, error)

	// Puts an object into the cache
	Put(key string, value interface{}, expire int64) error

	// Delete object from cache
	Delete(key string) error
}

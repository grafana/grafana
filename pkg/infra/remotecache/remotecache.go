package remotecache

import (
	"bytes"
	"context"
	"encoding/gob"
	"errors"
	"time"

	"github.com/go-kit/log"

	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	// ErrCacheItemNotFound is returned if cache does not exist
	ErrCacheItemNotFound = errors.New("cache item not found")

	// ErrInvalidCacheType is returned if the type is invalid
	ErrInvalidCacheType = errors.New("invalid remote cache name")

	defaultMaxCacheExpiration = time.Hour * 24
)

const (
	ServiceName = "RemoteCache"
)

func ProvideService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore) (*RemoteCache, error) {
	client, err := createClient(cfg.RemoteCacheOptions, sqlStore)
	if err != nil {
		return nil, err
	}
	s := &RemoteCache{
		SQLStore: sqlStore,
		Cfg:      cfg,
		log:      glog.New("cache.remote"),
		client:   client,
	}
	return s, nil
}

// CacheStorage allows the caller to set, get and delete items in the cache.
// Cached items are stored as byte arrays and marshalled using "encoding/gob"
// so any struct added to the cache needs to be registered with `remotecache.Register`
// ex `remotecache.Register(CacheableStruct{})`
type CacheStorage interface {
	// Get reads object from Cache
	Get(ctx context.Context, key string) (interface{}, error)

	// Set sets an object into the cache. if `expire` is set to zero it will default to 24h
	Set(ctx context.Context, key string, value interface{}, expire time.Duration) error

	// Delete object from cache
	Delete(ctx context.Context, key string) error
}

// RemoteCache allows Grafana to cache data outside its own process
type RemoteCache struct {
	log      log.Logger
	client   CacheStorage
	SQLStore *sqlstore.SQLStore
	Cfg      *setting.Cfg
}

// Get reads object from Cache
func (ds *RemoteCache) Get(ctx context.Context, key string) (interface{}, error) {
	return ds.client.Get(ctx, key)
}

// Set sets an object into the cache. if `expire` is set to zero it will default to 24h
func (ds *RemoteCache) Set(ctx context.Context, key string, value interface{}, expire time.Duration) error {
	if expire == 0 {
		expire = defaultMaxCacheExpiration
	}

	return ds.client.Set(ctx, key, value, expire)
}

// Delete object from cache
func (ds *RemoteCache) Delete(ctx context.Context, key string) error {
	return ds.client.Delete(ctx, key)
}

// Run starts the backend processes for cache clients.
func (ds *RemoteCache) Run(ctx context.Context) error {
	// create new interface if more clients need GC jobs
	backgroundjob, ok := ds.client.(registry.BackgroundService)
	if ok {
		return backgroundjob.Run(ctx)
	}

	<-ctx.Done()
	return ctx.Err()
}

func createClient(opts *setting.RemoteCacheOptions, sqlstore *sqlstore.SQLStore) (CacheStorage, error) {
	if opts.Name == redisCacheType {
		return newRedisStorage(opts)
	}

	if opts.Name == memcachedCacheType {
		return newMemcachedStorage(opts), nil
	}

	if opts.Name == databaseCacheType {
		return newDatabaseCache(sqlstore), nil
	}

	return nil, ErrInvalidCacheType
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

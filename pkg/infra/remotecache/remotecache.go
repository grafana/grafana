package remotecache

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/secrets"
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

func ProvideService(cfg *setting.Cfg, sqlStore db.DB, usageStats usagestats.Service,
	secretsService secrets.Service) (*RemoteCache, error) {
	client, err := createClient(cfg.RemoteCacheOptions, sqlStore)
	if err != nil {
		return nil, err
	}
	s := &RemoteCache{
		SQLStore: sqlStore,
		Cfg:      cfg,
		client:   client,
	}

	usageStats.RegisterMetricsFunc(s.getUsageStats)

	return s, nil
}

func (ds *RemoteCache) getUsageStats(ctx context.Context) (map[string]interface{}, error) {
	stats := map[string]interface{}{}
	stats["stats.remote_cache."+ds.Cfg.RemoteCacheOptions.Name+".count"] = 1
	encryptVal := 0
	if ds.Cfg.RemoteCacheOptions.Encryption {
		encryptVal = 1
	}

	stats["stats.remote_cache.encrypt_enabled.count"] = encryptVal

	return stats, nil
}

// CacheStorage allows the caller to set, get and delete items in the cache.
// Cached items are stored as byte arrays and marshalled using "encoding/gob"
// so any struct added to the cache needs to be registered with `remotecache.Register`
// ex `remotecache.Register(CacheableStruct{})`
type CacheStorage interface {
	// Get gets the cache value as an byte array
	Get(ctx context.Context, key string) ([]byte, error)

	// Set saves the value as an byte array. if `expire` is set to zero it will default to 24h
	Set(ctx context.Context, key string, value []byte, expire time.Duration) error

	// Delete object from cache
	Delete(ctx context.Context, key string) error

	// Count returns the number of items in the cache.
	// Optionaly a prefix can be provided to only count items with that prefix
	// DO NOT USE. Not available for memcached.
	Count(ctx context.Context, prefix string) (int64, error)
}

// RemoteCache allows Grafana to cache data outside its own process
type RemoteCache struct {
	client   CacheStorage
	SQLStore db.DB
	Cfg      *setting.Cfg
}

// Get returns the cached value as an byte array
func (ds *RemoteCache) Get(ctx context.Context, key string) ([]byte, error) {
	return ds.client.Get(ctx, key)
}

// Set stored the byte array in the cache
func (ds *RemoteCache) Set(ctx context.Context, key string, value []byte, expire time.Duration) error {
	if expire == 0 {
		expire = defaultMaxCacheExpiration
	}

	return ds.client.Set(ctx, key, value, expire)
}

// Delete object from cache
func (ds *RemoteCache) Delete(ctx context.Context, key string) error {
	return ds.client.Delete(ctx, key)
}

// Count returns the number of items in the cache.
func (ds *RemoteCache) Count(ctx context.Context, prefix string) (int64, error) {
	return ds.client.Count(ctx, prefix)
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

func createClient(opts *setting.RemoteCacheOptions, sqlstore db.DB) (cache CacheStorage, err error) {
	switch opts.Name {
	case redisCacheType:
		cache, err = newRedisStorage(opts)
	case memcachedCacheType:
		cache = newMemcachedStorage(opts)
	case databaseCacheType:
		cache = newDatabaseCache(sqlstore)
	default:
		return nil, ErrInvalidCacheType
	}
	if err != nil {
		return cache, err
	}
	if opts.Prefix != "" {
		cache = &prefixCacheStorage{cache: cache, prefix: opts.Prefix}
	}

	if opts.Encryption {
		cache = &encryptedCacheStorage{cache: cache}
	}
	return cache, nil
}

type encryptedCacheStorage struct {
	cache          CacheStorage
	secretsService encryptionService
}

type encryptionService interface {
	Encrypt(ctx context.Context, payload []byte, opt secrets.EncryptionOptions) ([]byte, error)
	Decrypt(ctx context.Context, payload []byte) ([]byte, error)
}

func (pcs *encryptedCacheStorage) Get(ctx context.Context, key string) ([]byte, error) {
	data, err := pcs.cache.Get(ctx, key)
	if err != nil {
		return nil, err
	}

	return pcs.secretsService.Decrypt(ctx, data)
}
func (pcs *encryptedCacheStorage) Set(ctx context.Context, key string, value []byte, expire time.Duration) error {
	encrypted, err := pcs.secretsService.Encrypt(ctx, value, secrets.WithoutScope())
	if err != nil {
		return err
	}

	return pcs.cache.Set(ctx, key, encrypted, expire)
}
func (pcs *encryptedCacheStorage) Delete(ctx context.Context, key string) error {
	return pcs.cache.Delete(ctx, key)
}

func (pcs *encryptedCacheStorage) Count(ctx context.Context, prefix string) (int64, error) {
	return pcs.cache.Count(ctx, prefix)
}

type prefixCacheStorage struct {
	cache  CacheStorage
	prefix string
}

func (pcs *prefixCacheStorage) Get(ctx context.Context, key string) ([]byte, error) {
	return pcs.cache.Get(ctx, pcs.prefix+key)
}
func (pcs *prefixCacheStorage) Set(ctx context.Context, key string, value []byte, expire time.Duration) error {
	return pcs.cache.Set(ctx, pcs.prefix+key, value, expire)
}
func (pcs *prefixCacheStorage) Delete(ctx context.Context, key string) error {
	return pcs.cache.Delete(ctx, pcs.prefix+key)
}

func (pcs *prefixCacheStorage) Count(ctx context.Context, prefix string) (int64, error) {
	return pcs.cache.Count(ctx, pcs.prefix+prefix)
}

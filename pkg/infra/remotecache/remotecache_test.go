package remotecache

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type CacheableStruct struct {
	String string
	Int64  int64
}

func init() {
	Register(CacheableStruct{})
}

func createTestClient(t *testing.T, opts *setting.RemoteCacheOptions, sqlstore db.DB) CacheStorage {
	t.Helper()

	cfg := &setting.Cfg{
		RemoteCacheOptions: opts,
	}
	dc, err := ProvideService(cfg, sqlstore)
	require.Nil(t, err, "Failed to init client for test")

	return dc
}

func TestCachedBasedOnConfig(t *testing.T) {
	cfg := setting.NewCfg()
	err := cfg.Load(setting.CommandLineArgs{
		HomePath: "../../../",
	})
	require.Nil(t, err, "Failed to load config")

	client := createTestClient(t, cfg.RemoteCacheOptions, db.InitTestDB(t))
	runTestsForClient(t, client)
}

func TestInvalidCacheTypeReturnsError(t *testing.T) {
	_, err := createClient(&setting.RemoteCacheOptions{Name: "invalid"}, nil)
	assert.Equal(t, err, ErrInvalidCacheType)
}

func runTestsForClient(t *testing.T, client CacheStorage) {
	canPutGetAndDeleteCachedObjects(t, client)
	canNotFetchExpiredItems(t, client)
}

func canPutGetAndDeleteCachedObjects(t *testing.T, client CacheStorage) {
	cacheableStruct := CacheableStruct{String: "hej", Int64: 2000}

	err := client.Set(context.Background(), "key1", cacheableStruct, 0)
	assert.Equal(t, err, nil, "expected nil. got: ", err)

	data, err := client.Get(context.Background(), "key1")
	assert.Equal(t, err, nil)
	s, ok := data.(CacheableStruct)

	assert.Equal(t, ok, true)
	assert.Equal(t, s.String, "hej")
	assert.Equal(t, s.Int64, int64(2000))

	err = client.Delete(context.Background(), "key1")
	assert.Equal(t, err, nil)

	_, err = client.Get(context.Background(), "key1")
	assert.Equal(t, err, ErrCacheItemNotFound)
}

func canNotFetchExpiredItems(t *testing.T, client CacheStorage) {
	cacheableStruct := CacheableStruct{String: "hej", Int64: 2000}

	err := client.Set(context.Background(), "key1", cacheableStruct, time.Second)
	assert.Equal(t, err, nil)

	// not sure how this can be avoided when testing redis/memcached :/
	<-time.After(time.Second + time.Millisecond)

	// should not be able to read that value since its expired
	_, err = client.Get(context.Background(), "key1")
	assert.Equal(t, err, ErrCacheItemNotFound)
}

func TestCachePrefix(t *testing.T) {
	db := db.InitTestDB(t)
	cache := &databaseCache{
		SQLStore: db,
		log:      log.New("remotecache.database"),
	}
	prefixCache := &prefixCacheStorage{cache: cache, prefix: "test/"}

	// Set a value (with a prefix)
	prefixCache.Set(context.Background(), "foo", "bar", time.Hour)
	// Get a value (with a prefix)
	v, err := prefixCache.Get(context.Background(), "foo")
	require.NoError(t, err)
	require.Equal(t, "bar", v)
	// Get a value directly from the underlying cache, ensure the prefix is in the key
	v, err = cache.Get(context.Background(), "test/foo")
	require.NoError(t, err)
	require.Equal(t, "bar", v)
	// Get a value directly from the underlying cache without a prefix, should not be there
	_, err = cache.Get(context.Background(), "foo")
	require.Error(t, err)
}

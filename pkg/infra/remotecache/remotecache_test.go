package remotecache

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
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
	dc, err := ProvideService(cfg, sqlstore, &usagestats.UsageStatsMock{}, fakes.NewFakeSecretsService())
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
	runCountTestsForClient(t, cfg.RemoteCacheOptions, db.InitTestDB(t))
}

func TestInvalidCacheTypeReturnsError(t *testing.T) {
	_, err := createClient(&setting.RemoteCacheOptions{Name: "invalid"}, nil, &gobCodec{})
	assert.Equal(t, err, ErrInvalidCacheType)
}

func runTestsForClient(t *testing.T, client CacheStorage) {
	canPutGetAndDeleteCachedObjects(t, client)
	canNotFetchExpiredItems(t, client)
}

func runCountTestsForClient(t *testing.T, opts *setting.RemoteCacheOptions, sqlstore db.DB) {
	client := createTestClient(t, opts, sqlstore)
	expectError := false
	if opts.Name == memcachedCacheType {
		expectError = true
	}

	t.Run("can count items", func(t *testing.T) {
		cacheableValue := []byte("hej hej")

		err := client.SetByteArray(context.Background(), "pref-key1", cacheableValue, 0)
		require.NoError(t, err)

		err = client.SetByteArray(context.Background(), "pref-key2", cacheableValue, 0)
		require.NoError(t, err)

		err = client.SetByteArray(context.Background(), "key3-not-pref", cacheableValue, 0)
		require.NoError(t, err)

		n, errC := client.Count(context.Background(), "pref-")
		if expectError {
			require.ErrorIs(t, ErrNotImplemented, errC)
			assert.Equal(t, int64(0), n)
			return
		}

		require.NoError(t, errC)
		assert.Equal(t, int64(2), n)
	})
}

func canPutGetAndDeleteCachedObjects(t *testing.T, client CacheStorage) {
	dataToCache := []byte("some bytes")

	err := client.SetByteArray(context.Background(), "key1", dataToCache, 0)
	assert.Equal(t, err, nil, "expected nil. got: ", err)

	data, err := client.GetByteArray(context.Background(), "key1")
	assert.Equal(t, err, nil)

	assert.Equal(t, string(data), "some bytes")

	err = client.Delete(context.Background(), "key1")
	assert.Equal(t, err, nil)

	_, err = client.GetByteArray(context.Background(), "key1")
	assert.Equal(t, err, ErrCacheItemNotFound)
}

func canNotFetchExpiredItems(t *testing.T, client CacheStorage) {
	dataToCache := []byte("some bytes")

	err := client.SetByteArray(context.Background(), "key1", dataToCache, time.Second)
	assert.Equal(t, err, nil)

	// not sure how this can be avoided when testing redis/memcached :/
	<-time.After(time.Second + time.Millisecond)

	// should not be able to read that value since its expired
	_, err = client.GetByteArray(context.Background(), "key1")
	assert.Equal(t, err, ErrCacheItemNotFound)
}

func TestCollectUsageStats(t *testing.T) {
	wantMap := map[string]interface{}{
		"stats.remote_cache.redis.count":           1,
		"stats.remote_cache.encrypt_enabled.count": 1,
	}
	cfg := setting.NewCfg()
	cfg.RemoteCacheOptions = &setting.RemoteCacheOptions{Name: redisCacheType, Encryption: true}

	remoteCache := &RemoteCache{
		Cfg: cfg,
	}

	stats, err := remoteCache.getUsageStats(context.Background())
	require.NoError(t, err)

	assert.EqualValues(t, wantMap, stats)
}

func TestCachePrefix(t *testing.T) {
	db := db.InitTestDB(t)
	cache := &databaseCache{
		SQLStore: db,
		log:      log.New("remotecache.database"),
		codec:    &gobCodec{},
	}
	prefixCache := &prefixCacheStorage{cache: cache, prefix: "test/"}

	// Set a value (with a prefix)
	err := prefixCache.SetByteArray(context.Background(), "foo", []byte("bar"), time.Hour)
	require.NoError(t, err)
	// Get a value (with a prefix)
	v, err := prefixCache.GetByteArray(context.Background(), "foo")
	require.NoError(t, err)
	require.Equal(t, "bar", string(v))
	// Get a value directly from the underlying cache, ensure the prefix is in the key
	v, err = cache.GetByteArray(context.Background(), "test/foo")
	require.NoError(t, err)
	require.Equal(t, "bar", string(v))
	// Get a value directly from the underlying cache without a prefix, should not be there
	_, err = cache.Get(context.Background(), "foo")
	require.Error(t, err)
}

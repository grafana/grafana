package remotecache

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func createTestClient(t *testing.T, opts *setting.RemoteCacheSettings, sqlstore db.DB) CacheStorage {
	t.Helper()

	cfg := &setting.Cfg{
		RemoteCacheOptions: opts,
	}
	dc, err := ProvideService(cfg, sqlstore, &usagestats.UsageStatsMock{}, fakes.NewFakeSecretsService())
	require.Nil(t, err, "Failed to init client for test")

	return dc
}

func TestIntegrationCachedBasedOnConfig(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	db, cfg := sqlstore.InitTestDB(t)
	err := cfg.Load(setting.CommandLineArgs{
		HomePath: "../../../",
	})
	require.Nil(t, err, "Failed to load config")

	client := createTestClient(t, cfg.RemoteCacheOptions, db)
	runTestsForClient(t, client)
}

func TestInvalidCacheTypeReturnsError(t *testing.T) {
	_, err := createClient(&setting.RemoteCacheSettings{Name: "invalid"}, nil, nil)
	assert.Equal(t, err, ErrInvalidCacheType)
}

func runTestsForClient(t *testing.T, client CacheStorage) {
	canPutGetAndDeleteCachedObjects(t, client)
	canNotFetchExpiredItems(t, client)
}

func canPutGetAndDeleteCachedObjects(t *testing.T, client CacheStorage) {
	dataToCache := []byte("some bytes")

	err := client.Set(context.Background(), "key1", dataToCache, 0)
	assert.Equal(t, err, nil, "expected nil. got: ", err)

	data, err := client.Get(context.Background(), "key1")
	assert.Equal(t, err, nil)

	assert.Equal(t, string(data), "some bytes")

	err = client.Delete(context.Background(), "key1")
	assert.Equal(t, err, nil)

	_, err = client.Get(context.Background(), "key1")
	// redis client returns redis.Nil error when key does not exist.
	assert.Error(t, err)
}

func canNotFetchExpiredItems(t *testing.T, client CacheStorage) {
	dataToCache := []byte("some bytes")

	err := client.Set(context.Background(), "key1", dataToCache, time.Second)
	assert.Equal(t, err, nil)

	// not sure how this can be avoided when testing redis/memcached :/
	<-time.After(time.Second + time.Millisecond)

	// should not be able to read that value since its expired
	_, err = client.Get(context.Background(), "key1")
	// redis client returns redis.Nil error when key does not exist.
	assert.Error(t, err)
}

func TestCollectUsageStats(t *testing.T) {
	wantMap := map[string]any{
		"stats.remote_cache.redis.count":           1,
		"stats.remote_cache.encrypt_enabled.count": 1,
	}
	cfg := setting.NewCfg()
	cfg.RemoteCacheOptions = &setting.RemoteCacheSettings{Name: redisCacheType, Encryption: true}

	remoteCache := &RemoteCache{
		Cfg: cfg,
	}

	stats, err := remoteCache.getUsageStats(context.Background())
	require.NoError(t, err)

	assert.EqualValues(t, wantMap, stats)
}

func TestCachePrefix(t *testing.T) {
	cache := NewFakeCacheStorage()
	prefixCache := &prefixCacheStorage{cache: cache, prefix: "test/"}

	// Set a value (with a prefix)
	err := prefixCache.Set(context.Background(), "foo", []byte("bar"), time.Hour)
	require.NoError(t, err)
	// Get a value (with a prefix)
	v, err := prefixCache.Get(context.Background(), "foo")
	require.NoError(t, err)
	require.Equal(t, "bar", string(v))
	// Get a value directly from the underlying cache, ensure the prefix is in the key
	v, err = cache.Get(context.Background(), "test/foo")
	require.NoError(t, err)
	require.Equal(t, "bar", string(v))
	// Get a value directly from the underlying cache without a prefix, should not be there
	_, err = cache.Get(context.Background(), "foo")
	require.Error(t, err)
}

func TestEncryptedCache(t *testing.T) {
	cache := NewFakeCacheStorage()
	encryptedCache := &encryptedCacheStorage{cache: cache, secretsService: &fakeSecretsService{}}

	// Set a value in the encrypted cache
	err := encryptedCache.Set(context.Background(), "foo", []byte("bar"), time.Hour)
	require.NoError(t, err)

	// make sure the stored value is not equal to input
	v, err := cache.Get(context.Background(), "foo")
	require.NoError(t, err)
	require.NotEqual(t, "bar", string(v))

	// make sure the returned value is the same as orignial
	v, err = encryptedCache.Get(context.Background(), "foo")
	require.NoError(t, err)
	require.Equal(t, "bar", string(v))
}

type fakeSecretsService struct{}

func (f fakeSecretsService) Encrypt(_ context.Context, payload []byte, _ secrets.EncryptionOptions) ([]byte, error) {
	return f.reverse(payload), nil
}

func (f fakeSecretsService) Decrypt(_ context.Context, payload []byte) ([]byte, error) {
	return f.reverse(payload), nil
}

func (f fakeSecretsService) reverse(input []byte) []byte {
	r := []rune(string(input))
	for i, j := 0, len(r)-1; i < len(r)/2; i, j = i+1, j-1 {
		r[i], r[j] = r[j], r[i]
	}
	return []byte(string(r))
}

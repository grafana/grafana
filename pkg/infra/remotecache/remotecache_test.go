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
	"github.com/grafana/grafana/pkg/setting"
)

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
	_, err := createClient(&setting.RemoteCacheOptions{Name: "invalid"}, nil, nil)
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

		err := client.Set(context.Background(), "pref-key1", cacheableValue, 0)
		require.NoError(t, err)

		err = client.Set(context.Background(), "pref-key2", cacheableValue, 0)
		require.NoError(t, err)

		err = client.Set(context.Background(), "key3-not-pref", cacheableValue, 0)
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

	err := client.Set(context.Background(), "key1", dataToCache, 0)
	assert.Equal(t, err, nil, "expected nil. got: ", err)

	data, err := client.Get(context.Background(), "key1")
	assert.Equal(t, err, nil)

	assert.Equal(t, string(data), "some bytes")

	err = client.Delete(context.Background(), "key1")
	assert.Equal(t, err, nil)

	_, err = client.Get(context.Background(), "key1")
	assert.Equal(t, err, ErrCacheItemNotFound)
}

func canNotFetchExpiredItems(t *testing.T, client CacheStorage) {
	dataToCache := []byte("some bytes")

	err := client.Set(context.Background(), "key1", dataToCache, time.Second)
	assert.Equal(t, err, nil)

	// not sure how this can be avoided when testing redis/memcached :/
	<-time.After(time.Second + time.Millisecond)

	// should not be able to read that value since its expired
	_, err = client.Get(context.Background(), "key1")
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

type fakeCacheStorage struct {
	storage map[string][]byte
}

func (fcs fakeCacheStorage) Set(_ context.Context, key string, value []byte, exp time.Duration) error {
	fcs.storage[key] = value
	return nil
}

func (fcs fakeCacheStorage) Get(_ context.Context, key string) ([]byte, error) {
	value, exist := fcs.storage[key]
	if !exist {
		return nil, ErrCacheItemNotFound
	}

	return value, nil
}

func (fcs fakeCacheStorage) Delete(_ context.Context, key string) error {
	delete(fcs.storage, key)
	return nil
}

func (fcs fakeCacheStorage) Count(_ context.Context, prefix string) (int64, error) {
	return int64(len(fcs.storage)), nil
}

func NewFakeCacheStorage() CacheStorage {
	return fakeCacheStorage{
		storage: map[string][]byte{},
	}
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

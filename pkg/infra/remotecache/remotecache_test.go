package remotecache

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type CacheableStruct struct {
	String string
	Int64  int64
}

func init() {
	Register(CacheableStruct{})
}

func createTestClient(t *testing.T, opts *setting.RemoteCacheOptions, sqlstore *sqlstore.SqlStore) CacheStorage {
	t.Helper()

	dc := &RemoteCache{
		SQLStore: sqlstore,
		Cfg: &setting.Cfg{
			RemoteCacheOptions: opts,
		},
	}

	err := dc.Init()
	require.Nil(t, err, "Failed to init client for test")

	return dc
}

func TestCachedBasedOnConfig(t *testing.T) {
	cfg := setting.NewCfg()
	err := cfg.Load(&setting.CommandLineArgs{
		HomePath: "../../../",
	})
	require.Nil(t, err, "Failed to load config")

	client := createTestClient(t, cfg.RemoteCacheOptions, sqlstore.InitTestDB(t))
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

	err := client.Set("key1", cacheableStruct, 0)
	assert.Equal(t, err, nil, "expected nil. got: ", err)

	data, err := client.Get("key1")
	assert.Equal(t, err, nil)
	s, ok := data.(CacheableStruct)

	assert.Equal(t, ok, true)
	assert.Equal(t, s.String, "hej")
	assert.Equal(t, s.Int64, int64(2000))

	err = client.Delete("key1")
	assert.Equal(t, err, nil)

	_, err = client.Get("key1")
	assert.Equal(t, err, ErrCacheItemNotFound)
}

func canNotFetchExpiredItems(t *testing.T, client CacheStorage) {
	cacheableStruct := CacheableStruct{String: "hej", Int64: 2000}

	err := client.Set("key1", cacheableStruct, time.Second)
	assert.Equal(t, err, nil)

	// not sure how this can be avoided when testing redis/memcached :/
	<-time.After(time.Second + time.Millisecond)

	// should not be able to read that value since its expired
	_, err = client.Get("key1")
	assert.Equal(t, err, ErrCacheItemNotFound)
}

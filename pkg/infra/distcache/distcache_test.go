package distcache

import (
	"testing"
	"time"

	"github.com/bmizerany/assert"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type CacheableStruct struct {
	String string
	Int64  int64
}

func init() {
	Register(CacheableStruct{})
}

func createTestClient(t *testing.T, opts *setting.CacheOpts, sqlstore *sqlstore.SqlStore) CacheStorage {
	t.Helper()

	dc := &DistributedCache{
		SQLStore: sqlstore,
		Cfg: &setting.Cfg{
			CacheOptions: opts,
		},
	}

	err := dc.Init()
	if err != nil {
		t.Fatalf("failed to init client for test. error: %v", err)
	}

	return dc.Client
}

func TestCachedBasedOnConfig(t *testing.T) {

	cfg := setting.NewCfg()
	cfg.Load(&setting.CommandLineArgs{
		HomePath: "../../../",
	})

	client := createTestClient(t, cfg.CacheOptions, sqlstore.InitTestDB(t))

	runTestsForClient(t, client)
}

func runTestsForClient(t *testing.T, client CacheStorage) {
	canPutGetAndDeleteCachedObjects(t, client)
	canNotFetchExpiredItems(t, client)
	canSetInfiniteCacheExpiration(t, client)
}

func canPutGetAndDeleteCachedObjects(t *testing.T, client CacheStorage) {
	cacheableStruct := CacheableStruct{String: "hej", Int64: 2000}

	err := client.Set("key1", cacheableStruct, 0)
	assert.Equal(t, err, nil, "expected nil. got: ", err)

	data, err := client.Get("key1")
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

	//not sure how this can be avoided when testing redis/memcached :/
	<-time.After(time.Second + time.Millisecond)

	// should not be able to read that value since its expired
	_, err = client.Get("key1")
	assert.Equal(t, err, ErrCacheItemNotFound)
}

func canSetInfiniteCacheExpiration(t *testing.T, client CacheStorage) {
	cacheableStruct := CacheableStruct{String: "hej", Int64: 2000}

	// insert cache item one day back
	getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
	err := client.Set("key1", cacheableStruct, 0)
	assert.Equal(t, err, nil)

	// should not be able to read that value since its expired
	getTime = time.Now
	data, err := client.Get("key1")
	s, ok := data.(CacheableStruct)

	assert.Equal(t, ok, true)
	assert.Equal(t, s.String, "hej")
	assert.Equal(t, s.Int64, int64(2000))
}

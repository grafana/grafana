package distcache

import (
	"encoding/gob"
	"testing"
	"time"

	"github.com/bmizerany/assert"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type CacheableStruct struct {
	String string
	Int64  int64
}

func init() {
	gob.Register(CacheableStruct{})
}

func createTestClient(t *testing.T, name string) cacheStorage {
	t.Helper()

	sqlstore := sqlstore.InitTestDB(t)
	return createClient(CacheOpts{name: name}, sqlstore)
}

func TestMemoryStorageClient(t *testing.T) {

	client := createTestClient(t, "memory")
	RunTestsForClient(t, client)
}

func RunTestsForClient(t *testing.T, client cacheStorage) {
	CanPutGetAndDeleteCachedObjects(t, client)
	CanNotFetchExpiredItems(t, client)
	CanSetInfiniteCacheExpiration(t, client)
}

func CanPutGetAndDeleteCachedObjects(t *testing.T, client cacheStorage) {
	cacheableStruct := CacheableStruct{String: "hej", Int64: 2000}

	err := client.Put("key", cacheableStruct, 0)
	assert.Equal(t, err, nil)

	data, err := client.Get("key")
	s, ok := data.(CacheableStruct)

	assert.Equal(t, ok, true)
	assert.Equal(t, s.String, "hej")
	assert.Equal(t, s.Int64, int64(2000))

	err = client.Delete("key")
	assert.Equal(t, err, nil)

	_, err = client.Get("key")
	assert.Equal(t, err, ErrCacheItemNotFound)
}

func CanNotFetchExpiredItems(t *testing.T, client cacheStorage) {
	cacheableStruct := CacheableStruct{String: "hej", Int64: 2000}

	err := client.Put("key", cacheableStruct, time.Second)
	assert.Equal(t, err, nil)

	//not sure how this can be avoided when testing redis/memcached :/
	<-time.After(time.Second + time.Millisecond)

	// should not be able to read that value since its expired
	_, err = client.Get("key")
	assert.Equal(t, err, ErrCacheItemNotFound)
}

func CanSetInfiniteCacheExpiration(t *testing.T, client cacheStorage) {
	cacheableStruct := CacheableStruct{String: "hej", Int64: 2000}

	// insert cache item one day back
	getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
	err := client.Put("key", cacheableStruct, 0)
	assert.Equal(t, err, nil)

	// should not be able to read that value since its expired
	getTime = time.Now
	data, err := client.Get("key")
	s, ok := data.(CacheableStruct)

	assert.Equal(t, ok, true)
	assert.Equal(t, s.String, "hej")
	assert.Equal(t, s.Int64, int64(2000))
}

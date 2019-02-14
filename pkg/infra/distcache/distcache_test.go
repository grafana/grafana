package distcache

import (
	"encoding/gob"
	"testing"
	"time"

	"github.com/bmizerany/assert"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type CacheableStruct struct {
	String string
	Int64  int64
}

func init() {
	gob.Register(CacheableStruct{})
}

func createClient(t *testing.T) cacheStorage {
	t.Helper()

	sqlstore := sqlstore.InitTestDB(t)
	dc := DistributedCache{log: log.New("test.logger"), SQLStore: sqlstore}
	dc.Init()
	return dc.Client
}

func TestCanPutIntoDatabaseStorage(t *testing.T) {
	client := createClient(t)
	cacheableStruct := CacheableStruct{String: "hej", Int64: 2000}

	err := client.Put("key", cacheableStruct, 1000)
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

func TestCanNotFetchExpiredItems(t *testing.T) {
	client := createClient(t)

	cacheableStruct := CacheableStruct{String: "hej", Int64: 2000}

	// insert cache item one day back
	getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
	err := client.Put("key", cacheableStruct, 10000)
	assert.Equal(t, err, nil)

	// should not be able to read that value since its expired
	getTime = time.Now
	_, err = client.Get("key")
	assert.Equal(t, err, ErrCacheItemNotFound)
}

func TestCanSetInfiniteCacheExpiration(t *testing.T) {
	client := createClient(t)

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

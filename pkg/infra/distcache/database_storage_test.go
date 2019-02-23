package distcache

import (
	"testing"
	"time"

	"github.com/bmizerany/assert"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestDatabaseStorageGarbageCollection(t *testing.T) {
	sqlstore := sqlstore.InitTestDB(t)

	db := &databaseCache{
		SQLStore: sqlstore,
		log:      log.New("distcache.database"),
	}

	obj := &CacheableStruct{String: "foolbar"}

	//set time.now to 2 weeks ago
	getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
	db.Put("key1", obj, 1000*time.Second)
	db.Put("key2", obj, 1000*time.Second)
	db.Put("key3", obj, 1000*time.Second)

	// insert object that should never expire
	db.Put("key4", obj, 0)

	getTime = time.Now
	db.Put("key5", obj, 1000*time.Second)

	//run GC
	db.internalRunGC()

	//try to read values
	_, err := db.Get("key1")
	assert.Equal(t, err, ErrCacheItemNotFound)
	_, err = db.Get("key2")
	assert.Equal(t, err, ErrCacheItemNotFound)
	_, err = db.Get("key3")
	assert.Equal(t, err, ErrCacheItemNotFound)

	_, err = db.Get("key4")
	assert.Equal(t, err, nil)
	_, err = db.Get("key5")
	assert.Equal(t, err, nil)
}

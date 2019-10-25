package remotecache

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/assert"
)

func TestDatabaseStorageGarbageCollection(t *testing.T) {
	sqlstore := sqlstore.InitTestDB(t)

	db := &databaseCache{
		SQLStore: sqlstore,
		log:      log.New("remotecache.database"),
	}

	obj := &CacheableStruct{String: "foolbar"}

	//set time.now to 2 weeks ago
	var err error
	getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
	err = db.Set("key1", obj, 1000*time.Second)
	assert.Equal(t, err, nil)

	err = db.Set("key2", obj, 1000*time.Second)
	assert.Equal(t, err, nil)

	err = db.Set("key3", obj, 1000*time.Second)
	assert.Equal(t, err, nil)

	// insert object that should never expire
	err = db.Set("key4", obj, 0)
	assert.Equal(t, err, nil)

	getTime = time.Now
	err = db.Set("key5", obj, 1000*time.Second)
	assert.Equal(t, err, nil)

	//run GC
	db.internalRunGC()

	//try to read values
	_, err = db.Get("key1")
	assert.Equal(t, err, ErrCacheItemNotFound, "expected cache item not found. got: ", err)
	_, err = db.Get("key2")
	assert.Equal(t, err, ErrCacheItemNotFound)
	_, err = db.Get("key3")
	assert.Equal(t, err, ErrCacheItemNotFound)

	_, err = db.Get("key4")
	assert.Equal(t, err, nil)
	_, err = db.Get("key5")
	assert.Equal(t, err, nil)
}

func TestSecondSet(t *testing.T) {
	var err error
	sqlstore := sqlstore.InitTestDB(t)

	db := &databaseCache{
		SQLStore: sqlstore,
		log:      log.New("remotecache.database"),
	}

	obj := &CacheableStruct{String: "hey!"}

	err = db.Set("killa-gorilla", obj, 0)
	assert.Equal(t, err, nil)

	err = db.Set("killa-gorilla", obj, 0)
	assert.Equal(t, err, nil)
}

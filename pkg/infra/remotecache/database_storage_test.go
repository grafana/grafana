package remotecache

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationDatabaseStorageGarbageCollection(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlstore := db.InitTestDB(t)

	db := &databaseCache{
		SQLStore: sqlstore,
		log:      log.New("remotecache.database"),
	}

	obj := []byte("foolbar")

	// set time.now to 2 weeks ago
	var err error
	getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
	err = db.Set(context.Background(), "key1", obj, 1000*time.Second)
	assert.Equal(t, err, nil)

	err = db.Set(context.Background(), "key2", obj, 1000*time.Second)
	assert.Equal(t, err, nil)

	err = db.Set(context.Background(), "key3", obj, 1000*time.Second)
	assert.Equal(t, err, nil)

	// insert object that should never expire
	err = db.Set(context.Background(), "key4", obj, 0)
	assert.Equal(t, err, nil)

	getTime = time.Now
	err = db.Set(context.Background(), "key5", obj, 1000*time.Second)
	assert.Equal(t, err, nil)

	// run GC
	db.internalRunGC()

	// try to read values
	_, err = db.Get(context.Background(), "key1")
	assert.Equal(t, err, ErrCacheItemNotFound, "expected cache item not found. got: ", err)
	_, err = db.Get(context.Background(), "key2")
	assert.Equal(t, err, ErrCacheItemNotFound)
	_, err = db.Get(context.Background(), "key3")
	assert.Equal(t, err, ErrCacheItemNotFound)

	_, err = db.Get(context.Background(), "key4")
	assert.Equal(t, err, nil)
	_, err = db.Get(context.Background(), "key5")
	assert.Equal(t, err, nil)
}

func TestIntegrationSecondSet(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	var err error
	sqlstore := db.InitTestDB(t)

	db := &databaseCache{
		SQLStore: sqlstore,
		log:      log.New("remotecache.database"),
	}

	obj := []byte("hey!")

	err = db.Set(context.Background(), "killa-gorilla", obj, 0)
	assert.Equal(t, err, nil)

	err = db.Set(context.Background(), "killa-gorilla", obj, 0)
	assert.Equal(t, err, nil)
}

func TestIntegrationConcurrentSet(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlstore := db.InitTestDB(t)
	cache := &databaseCache{
		SQLStore: sqlstore,
		log:      log.New("remotecache.database"),
	}

	const writers = 10
	const key = "shared-key"
	value := []byte("v")

	var wg sync.WaitGroup
	errs := make(chan error, writers)
	for i := 0; i < writers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := cache.Set(context.Background(), key, value, 5*time.Minute); err != nil {
				errs <- err
			}
		}()
	}
	wg.Wait()
	close(errs)

	for err := range errs {
		t.Errorf("concurrent Set returned error: %v", err)
	}

	got, err := cache.Get(context.Background(), key)
	require.NoError(t, err)
	assert.Equal(t, value, got)
}

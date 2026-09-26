package remotecache

import (
	"context"
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

	sqlstore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

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
	sqlstore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

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

// A machine that ran with its clock ahead writes rows stamped in the future.
// Once the clock is corrected those rows must be treated as stale instead of
// waiting unreachable time until real time catches up with created_at,
// otherwise poisoned entries (e.g. cached id tokens issued under the skewed
// clock) keep being served and fail verification on every use.
func TestIntegrationGetTreatsEntriesStampedInTheFutureAsExpired(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlstore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	dc := &databaseCache{
		SQLStore: sqlstore,
		log:      log.New("remotecache.database"),
	}

	obj := []byte("stale-after-clock-correction")

	t.Cleanup(func() { getTime = time.Now })

	// Write while the clock is two months ahead.
	getTime = func() time.Time { return time.Now().AddDate(0, 2, 0) }
	require.NoError(t, dc.Set(context.Background(), "skewed-key", obj, time.Hour))

	// Clock corrected: real now sits before the row's created_at, so the
	// elapsed-time expiry check can never fire. The entry must be reported
	// as missing (and dropped) instead of being served forever.
	getTime = time.Now
	_, err := dc.Get(context.Background(), "skewed-key")
	require.ErrorIs(t, err, ErrCacheItemNotFound)

	// With the stale row gone a fresh write becomes readable immediately.
	fresh := []byte("fresh")
	require.NoError(t, dc.Set(context.Background(), "skewed-key", fresh, time.Hour))
	got, err := dc.Get(context.Background(), "skewed-key")
	require.NoError(t, err)
	assert.Equal(t, fresh, got)

	// Entries that never expire are untouched by clock corrections.
	getTime = func() time.Time { return time.Now().AddDate(0, 2, 0) }
	require.NoError(t, dc.Set(context.Background(), "never-expire-skewed", obj, 0))
	getTime = time.Now
	got, err = dc.Get(context.Background(), "never-expire-skewed")
	require.NoError(t, err)
	assert.Equal(t, obj, got)
}

func TestIntegrationGarbageCollectionRemovesEntriesStampedInTheFuture(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlstore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	dc := &databaseCache{
		SQLStore: sqlstore,
		log:      log.New("remotecache.database"),
	}

	t.Cleanup(func() { getTime = time.Now })

	rowCount := func(key string) int64 {
		var count int64
		err := sqlstore.WithDbSession(context.Background(), func(session *db.Session) error {
			var err error
			count, err = session.Where("cache_key= ?", key).Count(&CacheData{})
			return err
		})
		require.NoError(t, err)
		return count
	}

	// Write while the clock is two months ahead, then correct it.
	getTime = func() time.Time { return time.Now().AddDate(0, 2, 0) }
	require.NoError(t, dc.Set(context.Background(), "gc-skewed", []byte("stale"), time.Hour))
	getTime = time.Now

	require.Equal(t, int64(1), rowCount("gc-skewed"))

	dc.internalRunGC()

	assert.Equal(t, int64(0), rowCount("gc-skewed"))
}

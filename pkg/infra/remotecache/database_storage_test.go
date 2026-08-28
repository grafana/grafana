package remotecache

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/VividCortex/mysqlerr"
	"github.com/go-sql-driver/mysql"
	promtestutil "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
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

func TestIntegrationSecondSetOverwritesValue(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlstore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	db := &databaseCache{
		SQLStore: sqlstore,
		log:      log.New("remotecache.database"),
	}

	ctx := t.Context()

	require.NoError(t, db.Set(ctx, "ha-key", []byte("first"), 0))
	require.NoError(t, db.Set(ctx, "ha-key", []byte("second"), 0))

	got, err := db.Get(ctx, "ha-key")
	require.NoError(t, err)
	require.Equal(t, []byte("second"), got, "second Set on an existing key must overwrite the stored value")
}

func TestIntegrationSetUpsertOverwritesExpiredEntry(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlstore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	db := &databaseCache{
		SQLStore: sqlstore,
		log:      log.New("remotecache.database"),
	}

	ctx := t.Context()

	require.NoError(t, db.Set(ctx, "expiring-key", []byte("stale"), time.Second))

	// Fast-forward past the expiry and keep the fake clock through Get: if the
	// upsert failed to rewrite expires/created_at, the original one-second
	// lifetime would still read as expired here and the Get would come back
	// empty instead of returning "fresh".
	getTime = func() time.Time { return time.Now().Add(2 * time.Hour) }
	t.Cleanup(func() { getTime = time.Now })

	require.NoError(t, db.Set(ctx, "expiring-key", []byte("fresh"), 0))

	got, err := db.Get(ctx, "expiring-key")
	require.NoError(t, err)
	require.Equal(t, []byte("fresh"), got, "re-setting an expired key must replace it without requiring a prior delete")
}

func TestIntegrationConcurrentSetUpsertsSameKey(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlstore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	db := &databaseCache{
		SQLStore: sqlstore,
		log:      log.New("remotecache.database"),
	}

	ctx := t.Context()
	require.NoError(t, db.Set(ctx, "ha-key", []byte("seed"), 0))

	const writers = 8
	const writesPerWriter = 10

	allowed := make(map[string]bool, writers*writesPerWriter)
	for w := 0; w < writers; w++ {
		for i := 0; i < writesPerWriter; i++ {
			allowed[fmt.Sprintf("writer-%d-iter-%d", w, i)] = true
		}
	}

	results := make([]error, writers*writesPerWriter)
	var wg sync.WaitGroup
	for w := 0; w < writers; w++ {
		wg.Add(1)
		go func(writer int) {
			defer wg.Done()
			for i := 0; i < writesPerWriter; i++ {
				payload := fmt.Sprintf("writer-%d-iter-%d", writer, i)
				results[writer*writesPerWriter+i] = db.Set(ctx, "ha-key", []byte(payload), 0)
			}
		}(w)
	}
	wg.Wait()

	// Racing writers must all report success: deadlocks on the upsert are
	// retried, and a write that keeps losing after retries is deliberately
	// dropped instead of failing the caller (same tolerance as before).
	for i, err := range results {
		require.NoError(t, err, "write %d from a racing writer must not fail", i)
	}

	got, err := db.Get(ctx, "ha-key")
	require.NoError(t, err)
	require.True(t, allowed[string(got)], "stored value must be one of the racing writes, got %q", got)
}

// syntheticDeadlock mirrors MySQL's lock deadlock (ER_LOCK_DEADLOCK), the one
// error class the upsert retry loop reacts to.
var syntheticDeadlock = &mysql.MySQLError{
	Number:  mysqlerr.ER_LOCK_DEADLOCK,
	Message: "Lock deadlock detected; try restarting transaction",
}

// deadlockDialect delegates everything to the engine's real dialect except
// IsDeadlock, so the deadlock retry policy becomes exercisable on every test
// database engine.
//
// MySQL only: the synthetic ER_LOCK_DEADLOCK is the only shape this wrapper
// recognises. Postgres deadlocks carry SQLSTATE 40P01 and are matched by the
// real dialect's IsDeadlock; the wrapper deliberately does not handle them
// because the deterministic retry test only needs a single deadlock shape,
// and forcing both would need a separate synthetic error per engine. The
// Postgres retry path is exercised end-to-end by the integration test running
// against a real cluster (no deadlockingStore in that path).
type deadlockDialect struct {
	migrator.Dialect
}

func (d deadlockDialect) IsDeadlock(err error) bool {
	var driverErr *mysql.MySQLError
	return errors.As(err, &driverErr) && driverErr.Number == mysqlerr.ER_LOCK_DEADLOCK
}

// deadlockingStore fails its next `failing` sessions with a synthetic deadlock
// before delegating to the real store, so Set's retry loop can be driven
// deterministically without needing a real MySQL cluster.
type deadlockingStore struct {
	db.DB

	mu       sync.Mutex
	failing  int
	attempts int
}

func (s *deadlockingStore) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	s.mu.Lock()
	s.attempts++
	inject := s.failing > 0
	if inject {
		s.failing--
	}
	s.mu.Unlock()

	if inject {
		return syntheticDeadlock
	}
	return s.DB.WithDbSession(ctx, callback)
}

func (s *deadlockingStore) GetDialect() migrator.Dialect {
	return deadlockDialect{s.DB.GetDialect()}
}

func (s *deadlockingStore) attemptCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.attempts
}

func TestIntegrationSetRetriesUpsertAfterDeadlocks(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("recovers after transient deadlocks", func(t *testing.T) {
		realStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		store := &deadlockingStore{DB: realStore, failing: 2}
		cache := &databaseCache{SQLStore: store, log: log.New("remotecache.database")}

		ctx := t.Context()
		require.NoError(t, cache.Set(ctx, "dl-key", []byte("eventual"), 0), "a deadlock that clears on retry must not fail Set")

		require.Equal(t, 3, store.attemptCount(), "upsert must be re-executed after each deadlock")

		got, err := cache.Get(ctx, "dl-key")
		require.NoError(t, err)
		require.Equal(t, []byte("eventual"), got, "the retried write must have landed in the database")
	})

	t.Run("drops the write after exhausting retries like the old update path did", func(t *testing.T) {
		realStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		seeded := &databaseCache{SQLStore: realStore, log: log.New("remotecache.database")}

		ctx := t.Context()
		require.NoError(t, seeded.Set(ctx, "dl-key", []byte("original"), 0))

		store := &deadlockingStore{DB: realStore, failing: 1000}
		cache := &databaseCache{SQLStore: store, log: log.New("remotecache.database")}

		before := promtestutil.ToFloat64(upsertDeadlockDropped)

		require.NoError(t, cache.Set(ctx, "dl-key", []byte("lost-write"), 0),
			"persistent deadlock must degrade to a dropped cache write, not a caller error")

		got, err := seeded.Get(ctx, "dl-key")
		require.NoError(t, err)
		require.Equal(t, []byte("original"), got, "row must keep its previous value when the losing writer gives up")

		after := promtestutil.ToFloat64(upsertDeadlockDropped)
		require.Equal(t, before+1, after, "upsertDeadlockDropped must be incremented exactly once when the retry budget is exhausted")
	})
}

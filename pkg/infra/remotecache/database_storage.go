package remotecache

import (
	"context"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
)

// getTime is a package-level seam for tests to install a fake clock. The
// tests that override it (e.g. TestIntegrationSetUpsertOverwritesExpiredEntry)
// rely on Go's per-package test serialisation: go test does not parallelise
// within a package by default, so the override is safe. Do not move any test
// that mutates getTime into a t.Parallel group without reworking the seam.
var getTime = time.Now

// upsertDeadlockDropped counts the cache writes that gave up after exhausting
// the deadlock retry budget. These are silent at the Set level (the call
// returns nil to preserve the old insert-then-update tolerance) and the Debug
// log is off by default, so without this metric operators would only notice
// the drops by missing keys. Distinct from transient deadlocks that were
// recovered within the budget, which are not separately counted — the log
// line in Set is the only signal for those.
var upsertDeadlockDropped = prometheus.NewCounter(prometheus.CounterOpts{
	Namespace: "grafana",
	Subsystem: "remotecache",
	Name:      "upsert_deadlock_dropped_total",
	Help:      "Cache writes dropped after the deadlock retry budget was exhausted (loser tolerated to keep the old insert-then-update semantics).",
})

// Deadlocks on a single-statement upsert are transient contention between HA
// writers; a short bounded retry usually lands the write. Mirrors how the
// server-lock service retries deadlocked lock acquisitions.
//
// Worst-case budget: with MinBackoff=2ms, MaxBackoff=32ms and MaxRetries=5,
// the backoff sleeps sum to at most 2+4+8+16+32 = 62 ms across up to 6
// sessions (initial + 5 retries) before we drop the write. Callers on a tight
// hot path (session storage, rate-limit counters) should treat any single Set
// as potentially latency-bound by this budget when the cache database is
// contended.
var upsertDeadlockBackoff = backoff.Config{
	MinBackoff: 2 * time.Millisecond,
	MaxBackoff: 32 * time.Millisecond,
	MaxRetries: 5,
}

const databaseCacheType = "database"

type databaseCache struct {
	SQLStore db.DB
	log      log.Logger
}

func newDatabaseCache(sqlstore db.DB) *databaseCache {
	dc := &databaseCache{
		SQLStore: sqlstore,
		log:      log.New("remotecache.database"),
	}

	return dc
}

func (dc *databaseCache) Run(ctx context.Context) error {
	ticker := time.NewTicker(time.Minute * 10)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			dc.internalRunGC()
		}
	}
}

func (dc *databaseCache) internalRunGC() {
	err := dc.SQLStore.WithDbSession(context.Background(), func(session *db.Session) error {
		now := getTime().Unix()
		sql := `DELETE FROM cache_data WHERE (? - created_at) >= expires AND expires <> 0`

		_, err := session.Exec(sql, now)
		return err
	})

	if err != nil {
		dc.log.Error("failed to run garbage collect", "error", err)
	}
}

func (dc *databaseCache) Get(ctx context.Context, key string) ([]byte, error) {
	cacheHit := CacheData{}

	err := dc.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		exist, err := session.Where("cache_key= ?", key).Get(&cacheHit)

		if err != nil {
			return err
		}

		if !exist {
			return ErrCacheItemNotFound
		}

		if cacheHit.Expires > 0 {
			existedButExpired := getTime().Unix()-cacheHit.CreatedAt >= cacheHit.Expires
			if existedButExpired {
				err = dc.Delete(ctx, key) // ignore this error since we will return `ErrCacheItemNotFound` anyway
				if err != nil {
					dc.log.Debug("Deletion of expired key failed: %v", err)
				}
				return ErrCacheItemNotFound
			}
		}

		return nil
	})

	return cacheHit.Data, err
}

func (dc *databaseCache) Set(ctx context.Context, key string, data []byte, expire time.Duration) error {
	var expiresInSeconds int64
	if expire != 0 {
		expiresInSeconds = int64(expire) / int64(time.Second)
	}

	// Single-statement upsert: the previous insert-then-update-on-conflict
	// approach logged a server-side unique-violation error on every racing
	// write, which flooded database logs in HA setups sharing one database,
	// and left a window where concurrent writers could fail the whole Set.
	sql := dc.SQLStore.GetDialect().UpsertSQL(
		"cache_data",
		[]string{"cache_key"},
		[]string{"cache_key", "data", "created_at", "expires"},
	)

	// The loop wraps the whole session so each retry re-executes the upsert on a
	// fresh session, mirroring the server-lock deadlock retry.
	//
	// We intentionally only retry on IsDeadlock. Unique-constraint violations
	// would not be produced by ON CONFLICT / ON DUPLICATE KEY UPDATE, so a
	// unique-violation here is a real schema bug (e.g. a stale migration left
	// a non-unique index) and should bubble up rather than be retried.
	var err error
	boff := backoff.New(ctx, upsertDeadlockBackoff)
	for {
		err = dc.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
			_, err := session.Exec(sql, key, data, getTime().Unix(), expiresInSeconds)
			return err
		})
		if err == nil || !dc.SQLStore.GetDialect().IsDeadlock(err) {
			return err
		}
		if !boff.Ongoing() {
			break
		}
		dc.log.Debug("Retrying cache upsert after deadlock", "key", key, "attempt", boff.NumRetries()+1)
		boff.Wait()
	}

	if ctxErr := ctx.Err(); ctxErr != nil {
		return ctxErr
	}
	// A persistent deadlock means another writer is upserting the same key
	// and will win; losing one cache refresh is harmless, so keep the old
	// insert-then-update tolerance instead of failing callers with
	// contention errors. Count it so operators can see when the budget is
	// not enough, since the Debug log is off by default.
	upsertDeadlockDropped.Inc()
	dc.log.Debug("Upsert of cache entry kept deadlocking, dropping this write", "key", key)
	return nil
}

func (dc *databaseCache) Delete(ctx context.Context, key string) error {
	return dc.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		sql := "DELETE FROM cache_data WHERE cache_key=?"
		_, err := session.Exec(sql, key)

		return err
	})
}

// CacheData is the struct representing the table in the database
type CacheData struct {
	CacheKey  string
	Data      []byte
	Expires   int64
	CreatedAt int64
}

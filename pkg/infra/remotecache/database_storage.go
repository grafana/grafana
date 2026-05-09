package remotecache

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
)

var getTime = time.Now

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
	return dc.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		var expiresInSeconds int64
		if expire != 0 {
			expiresInSeconds = int64(expire) / int64(time.Second)
		}

		upsertSQL := dc.SQLStore.GetDialect().UpsertSQL(
			"cache_data",
			[]string{"cache_key"},
			[]string{"cache_key", "data", "created_at", "expires"},
		)
		_, err := session.Exec(upsertSQL, key, data, getTime().Unix(), expiresInSeconds)
		if err != nil && dc.SQLStore.GetDialect().IsDeadlock(err) {
			// Another writer is upserting the same key; the cache will converge.
			return nil
		}
		return err
	})
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

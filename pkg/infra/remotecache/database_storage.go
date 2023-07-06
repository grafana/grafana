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

		// attempt to insert the key
		sql := `INSERT INTO cache_data (cache_key,data,created_at,expires) VALUES(?,?,?,?)`
		_, err := session.Exec(sql, key, data, getTime().Unix(), expiresInSeconds)
		if err != nil {
			// attempt to update if a unique constrain violation or a deadlock (for MySQL) occurs
			// if the update fails propagate the error
			// which eventually will result in a key that is not finally set
			// but since it's a cache does not harm a lot
			if dc.SQLStore.GetDialect().IsUniqueConstraintViolation(err) || dc.SQLStore.GetDialect().IsDeadlock(err) {
				sql := `UPDATE cache_data SET data=?, created_at=?, expires=? WHERE cache_key=?`
				_, err = session.Exec(sql, data, getTime().Unix(), expiresInSeconds, key)
				if err != nil && dc.SQLStore.GetDialect().IsDeadlock(err) {
					// most probably somebody else is upserting the key
					// so it is safe enough not to propagate this error
					return nil
				}
			}
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

func (dc *databaseCache) Count(ctx context.Context, prefix string) (int64, error) {
	res := int64(0)
	err := dc.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		sql := "SELECT COUNT(*) FROM cache_data WHERE cache_key LIKE ?"

		_, err := session.SQL(sql, prefix+"%").Get(&res)
		if err != nil {
			return err
		}

		return nil
	})

	return res, err
}

// CacheData is the struct representing the table in the database
type CacheData struct {
	CacheKey  string
	Data      []byte
	Expires   int64
	CreatedAt int64
}

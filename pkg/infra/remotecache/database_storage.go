package remotecache

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

var getTime = time.Now

const databaseCacheType = "database"

type databaseCache struct {
	SQLStore *sqlstore.SqlStore
	log      log.Logger
}

func newDatabaseCache(sqlstore *sqlstore.SqlStore) *databaseCache {
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
	now := getTime().Unix()
	sql := `DELETE FROM cache_data WHERE (? - created_at) >= expires AND expires <> 0`

	_, err := dc.SQLStore.NewSession().Exec(sql, now)
	if err != nil {
		dc.log.Error("failed to run garbage collect", "error", err)
	}
}

func (dc *databaseCache) Get(key string) (interface{}, error) {
	cacheHit := CacheData{}
	session := dc.SQLStore.NewSession()
	defer session.Close()

	exist, err := session.Where("cache_key= ?", key).Get(&cacheHit)

	if err != nil {
		return nil, err
	}

	if !exist {
		return nil, ErrCacheItemNotFound
	}

	if cacheHit.Expires > 0 {
		existedButExpired := getTime().Unix()-cacheHit.CreatedAt >= cacheHit.Expires
		if existedButExpired {
			_ = dc.Delete(key) //ignore this error since we will return `ErrCacheItemNotFound` anyway
			return nil, ErrCacheItemNotFound
		}
	}

	item := &cachedItem{}
	if err = decodeGob(cacheHit.Data, item); err != nil {
		return nil, err
	}

	return item.Val, nil
}

func (dc *databaseCache) Set(key string, value interface{}, expire time.Duration) error {
	item := &cachedItem{Val: value}
	data, err := encodeGob(item)
	if err != nil {
		return err
	}

	session := dc.SQLStore.NewSession()

	var cacheHit CacheData
	has, err := session.Where("cache_key = ?", key).Get(&cacheHit)
	if err != nil {
		return err
	}

	var expiresInSeconds int64
	if expire != 0 {
		expiresInSeconds = int64(expire) / int64(time.Second)
	}

	// insert or update depending on if item already exist
	if has {
		sql := `UPDATE cache_data SET data=?, created_at=?, expires=? WHERE cache_key=?`
		_, err = session.Exec(sql, data, getTime().Unix(), expiresInSeconds, key)
	} else {
		sql := `INSERT INTO cache_data (cache_key,data,created_at,expires) VALUES(?,?,?,?)`
		_, err = session.Exec(sql, key, data, getTime().Unix(), expiresInSeconds)
	}

	return err
}

func (dc *databaseCache) Delete(key string) error {
	sql := "DELETE FROM cache_data WHERE cache_key=?"
	_, err := dc.SQLStore.NewSession().Exec(sql, key)

	return err
}

type CacheData struct {
	CacheKey  string
	Data      []byte
	Expires   int64
	CreatedAt int64
}

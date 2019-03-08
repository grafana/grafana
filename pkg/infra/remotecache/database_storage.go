package remotecache

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

var getTime = time.Now

type databaseCache struct {
	SQLStore *sqlstore.SqlStore
	log      log.Logger
}

func newDatabaseCache(sqlstore *sqlstore.SqlStore) *databaseCache {
	dc := &databaseCache{
		SQLStore: sqlstore,
		log:      log.New("distcache.database"),
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
	cacheHits := []CacheData{}
	sess := dc.SQLStore.NewSession()
	defer sess.Close()
	err := sess.Where("cache_key= ?", key).Find(&cacheHits)

	if err != nil {
		return nil, err
	}

	if len(cacheHits) == 0 {
		return nil, ErrCacheItemNotFound
	}

	cacheHit := cacheHits[0]
	if cacheHit.Expires > 0 {
		existedButExpired := getTime().Unix()-cacheHit.CreatedAt >= cacheHit.Expires
		if existedButExpired {
			dc.Delete(key)
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

	var expiresAtEpoch int64
	if expire != 0 {
		expiresAtEpoch = int64(expire) / int64(time.Second)
	}

	// insert or update depending on if item already exist
	if has {
		_, err = session.Exec(`UPDATE cache_data SET data=?, created=?, expire=? WHERE cache_key='?'`, data, getTime().Unix(), expiresAtEpoch, key)
	} else {
		_, err = session.Exec(`INSERT INTO cache_data (cache_key,data,created_at,expires) VALUES(?,?,?,?)`, key, data, getTime().Unix(), expiresAtEpoch)
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

// func (cd CacheData) TableName() string { return "cache_data" }

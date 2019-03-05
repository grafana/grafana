package distcache

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

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

var getTime = time.Now

func (dc *databaseCache) internalRunGC() {
	now := getTime().Unix()
	sql := `DELETE FROM cache_data WHERE (? - created_at) >= expires AND expires <> 0`

	_, err := dc.SQLStore.NewSession().Exec(sql, now)
	if err != nil {
		dc.log.Error("failed to run garbage collect", "error", err)
	}
}

func (dc *databaseCache) Get(key string) (interface{}, error) {
	cacheHits := []cacheData{}
	err := dc.SQLStore.NewSession().Where(`key = ?`, key).Find(&cacheHits)
	if err != nil {
		return nil, err
	}

	var cacheHit cacheData
	if len(cacheHits) == 0 {
		return nil, ErrCacheItemNotFound
	}

	cacheHit = cacheHits[0]
	// if Expires is set. Make sure its still valid.
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

	now := getTime().Unix()
	cacheHits := []cacheData{}
	err = dc.SQLStore.NewSession().Where(`key = ?`, key).Find(&cacheHits)
	if err != nil {
		return err
	}

	var expiresAtEpoch int64
	if expire != 0 {
		expiresAtEpoch = int64(expire) / int64(time.Second)
	}

	session := dc.SQLStore.NewSession()
	// insert or update depending on if item already exist
	if len(cacheHits) > 0 {
		_, err = session.Exec("UPDATE cache_data SET data=?, created=?, expire=? WHERE key=?", data, now, expiresAtEpoch, key)
	} else {
		_, err = session.Exec("INSERT INTO cache_data(key,data,created_at,expires) VALUES(?,?,?,?)", key, data, now, expiresAtEpoch)
	}

	return err
}

func (dc *databaseCache) Delete(key string) error {
	sql := `DELETE FROM cache_data WHERE key = ?`
	_, err := dc.SQLStore.NewSession().Exec(sql, key)

	return err
}

type cacheData struct {
	Key       string
	Data      []byte
	Expires   int64
	CreatedAt int64
}

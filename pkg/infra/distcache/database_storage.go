package distcache

import (
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

	//go dc.StartGC() //TODO: start the GC somehow
	return dc
}

var getTime = time.Now

func (dc *databaseCache) internalRunGC() {
	now := getTime().Unix()
	sql := `DELETE FROM cache_data WHERE (? - created) >= expire`

	//EXTRACT(EPOCH FROM NOW()) - created >= expire
	//UNIX_TIMESTAMP(NOW()) - created >= expire
	_, err := dc.SQLStore.NewSession().Exec(sql, now)
	if err != nil {
		dc.log.Error("failed to run garbage collect", "error", err)
	}
}

func (dc *databaseCache) StartGC() {
	dc.internalRunGC()

	time.AfterFunc(time.Second*10, func() {
		dc.StartGC()
	})
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
	if cacheHit.Expires > 0 {
		if getTime().Unix()-cacheHit.CreatedAt >= cacheHit.Expires {
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

type cacheData struct {
	Key       string
	Data      []byte
	Expires   int64
	CreatedAt int64
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

	var expiresInEpoch int64
	if expire != 0 {
		expiresInEpoch = int64(expire) / int64(time.Second)
	}

	if len(cacheHits) > 0 {
		_, err = dc.SQLStore.NewSession().Exec("UPDATE cache_data SET data=?, created=?, expire=? WHERE key=?", data, now, expiresInEpoch, key)
	} else {
		_, err = dc.SQLStore.NewSession().Exec("INSERT INTO cache_data(key,data,created_at,expires) VALUES(?,?,?,?)", key, data, now, expiresInEpoch)
	}

	return err
}

func (dc *databaseCache) Delete(key string) error {
	sql := `DELETE FROM cache_data WHERE key = ?`

	_, err := dc.SQLStore.NewSession().Exec(sql, key)

	return err
}

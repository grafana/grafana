package distcache

import (
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type databaseCache struct {
	SQLStore *sqlstore.SqlStore
}

var getTime = time.Now

func (dc *databaseCache) Get(key string) (interface{}, error) {
	//now := getTime().Unix()

	cacheHits := []CacheData{}
	err := dc.SQLStore.NewSession().Where(`key = ?`, key).Find(&cacheHits)
	if err != nil {
		return nil, err
	}

	var cacheHit CacheData
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

	item := &Item{}
	if err = DecodeGob(cacheHit.Data, item); err != nil {
		return nil, err
	}

	return item.Val, nil
}

type CacheData struct {
	Key       string
	Data      []byte
	Expires   int64
	CreatedAt int64
}

func (dc *databaseCache) Put(key string, value interface{}, expire int64) error {
	item := &Item{Val: value}
	data, err := EncodeGob(item)
	if err != nil {
		return err
	}

	now := getTime().Unix()

	cacheHits := []CacheData{}
	err = dc.SQLStore.NewSession().Where(`key = ?`, key).Find(&cacheHits)
	if err != nil {
		return err
	}

	if len(cacheHits) > 0 {
		_, err = dc.SQLStore.NewSession().Exec("UPDATE cached_data SET data=?, created=?, expire=? WHERE key=?", data, now, expire, key)
	} else {
		_, err = dc.SQLStore.NewSession().Exec("INSERT INTO cache_data(key,data,created_at,expires) VALUES(?,?,?,?)", key, data, now, expire)
	}

	return err
}

func (dc *databaseCache) Delete(key string) error {
	sql := `DELETE FROM cache_data WHERE key = ?`

	_, err := dc.SQLStore.NewSession().Exec(sql, key)

	return err
}

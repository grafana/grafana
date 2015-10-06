package core

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

const (
	// default cache expired time
	CacheExpired = 60 * time.Minute
	// not use now
	CacheMaxMemory = 256
	// evey ten minutes to clear all expired nodes
	CacheGcInterval = 10 * time.Minute
	// each time when gc to removed max nodes
	CacheGcMaxRemoved = 20
)

var (
	ErrCacheMiss = errors.New("xorm/cache: key not found.")
	ErrNotStored = errors.New("xorm/cache: not stored.")
)

// CacheStore is a interface to store cache
type CacheStore interface {
	// key is primary key or composite primary key
	// value is struct's pointer
	// key format : <tablename>-p-<pk1>-<pk2>...
	Put(key string, value interface{}) error
	Get(key string) (interface{}, error)
	Del(key string) error
}

// Cacher is an interface to provide cache
// id format : u-<pk1>-<pk2>...
type Cacher interface {
	GetIds(tableName, sql string) interface{}
	GetBean(tableName string, id string) interface{}
	PutIds(tableName, sql string, ids interface{})
	PutBean(tableName string, id string, obj interface{})
	DelIds(tableName, sql string)
	DelBean(tableName string, id string)
	ClearIds(tableName string)
	ClearBeans(tableName string)
}

func encodeIds(ids []PK) (string, error) {
	b, err := json.Marshal(ids)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func decodeIds(s string) ([]PK, error) {
	pks := make([]PK, 0)
	err := json.Unmarshal([]byte(s), &pks)
	return pks, err
}

func GetCacheSql(m Cacher, tableName, sql string, args interface{}) ([]PK, error) {
	bytes := m.GetIds(tableName, GenSqlKey(sql, args))
	if bytes == nil {
		return nil, errors.New("Not Exist")
	}
	return decodeIds(bytes.(string))
}

func PutCacheSql(m Cacher, ids []PK, tableName, sql string, args interface{}) error {
	bytes, err := encodeIds(ids)
	if err != nil {
		return err
	}
	m.PutIds(tableName, GenSqlKey(sql, args), bytes)
	return nil
}

func GenSqlKey(sql string, args interface{}) string {
	return fmt.Sprintf("%v-%v", sql, args)
}

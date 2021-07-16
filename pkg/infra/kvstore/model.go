package kvstore

import (
	"errors"
	"time"
)

var (
	ErrNotFound = errors.New("key/value item not found")
)

type KVStoreItem struct {
	Id        int64
	OrgId     *int64
	Namespace *string
	Key       *string
	Value     string

	Created time.Time
	Updated time.Time
}

func (k *KVStoreItem) TableName() string {
	return "kv_store"
}

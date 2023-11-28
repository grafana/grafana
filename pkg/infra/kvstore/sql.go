package kvstore

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
)

// kvStoreSQL provides a key/value store backed by the Grafana database
type kvStoreSQL struct {
	log      log.Logger
	sqlStore db.DB
}

// Get an item from the store
func (kv *kvStoreSQL) Get(ctx context.Context, orgId int64, namespace string, key string) (string, bool, error) {
	item := Item{
		OrgId:     &orgId,
		Namespace: &namespace,
		Key:       &key,
	}
	var itemFound bool

	err := kv.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		has, err := dbSession.Get(&item)
		if err != nil {
			kv.log.Debug("error getting kvstore value", "orgId", orgId, "namespace", namespace, "key", key, "err", err)
			return err
		}
		if !has {
			kv.log.Debug("kvstore value not found", "orgId", orgId, "namespace", namespace, "key", key)
			return nil
		}
		itemFound = true
		kv.log.Debug("got kvstore value", "orgId", orgId, "namespace", namespace, "key", key, "value", item.Value)
		return nil
	})

	return item.Value, itemFound, err
}

// Set an item in the store
func (kv *kvStoreSQL) Set(ctx context.Context, orgId int64, namespace string, key string, value string) error {
	return kv.sqlStore.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
		item := Item{
			OrgId:     &orgId,
			Namespace: &namespace,
			Key:       &key,
		}

		has, err := dbSession.Get(&item)
		if err != nil {
			kv.log.Debug("error checking kvstore value", "orgId", orgId, "namespace", namespace, "key", key, "value", value, "err", err)
			return err
		}

		if has && item.Value == value {
			kv.log.Debug("kvstore value not changed", "orgId", orgId, "namespace", namespace, "key", key, "value", value)
			return nil
		}

		item.Value = value
		item.Updated = time.Now()

		if has {
			_, err = dbSession.Exec("UPDATE kv_store SET value = ?, updated = ? WHERE id = ?", item.Value, item.Updated, item.Id)
			if err != nil {
				kv.log.Debug("error updating kvstore value", "orgId", orgId, "namespace", namespace, "key", key, "value", value, "err", err)
			} else {
				kv.log.Debug("kvstore value updated", "orgId", orgId, "namespace", namespace, "key", key, "value", value)
			}
			return err
		}

		item.Created = item.Updated
		_, err = dbSession.Insert(&item)
		if err != nil {
			kv.log.Debug("error inserting kvstore value", "orgId", orgId, "namespace", namespace, "key", key, "value", value, "err", err)
		} else {
			kv.log.Debug("kvstore value inserted", "orgId", orgId, "namespace", namespace, "key", key, "value", value)
		}
		return err
	})
}

// Del deletes an item from the store.
func (kv *kvStoreSQL) Del(ctx context.Context, orgId int64, namespace string, key string) error {
	err := kv.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		query := fmt.Sprintf("DELETE FROM kv_store WHERE org_id=? and namespace=? and %s=?", kv.sqlStore.GetDialect().Quote("key"))
		_, err := dbSession.Exec(query, orgId, namespace, key)
		return err
	})
	return err
}

// Keys get all keys for a given namespace and keyPrefix. To query for all
// organizations the constant 'kvstore.AllOrganizations' can be passed as orgId.
func (kv *kvStoreSQL) Keys(ctx context.Context, orgId int64, namespace string, keyPrefix string) ([]Key, error) {
	var keys []Key
	err := kv.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		query := dbSession.Where("namespace = ?", namespace).And(fmt.Sprintf("%s LIKE ?", kv.sqlStore.GetDialect().Quote("key")), keyPrefix+"%")
		if orgId != AllOrganizations {
			query.And("org_id = ?", orgId)
		}
		return query.Find(&keys)
	})
	return keys, err
}

// GetAll get all items a given namespace and org. To query for all
// organizations the constant 'kvstore.AllOrganizations' can be passed as orgId.
// The map result is like map[orgId]map[key]value
func (kv *kvStoreSQL) GetAll(ctx context.Context, orgId int64, namespace string) (map[int64]map[string]string, error) {
	var results []Item
	err := kv.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		query := dbSession.Where("namespace = ?", namespace)
		if orgId != AllOrganizations {
			query.And("org_id = ?", orgId)
		}

		return query.Find(&results)
	})

	items := map[int64]map[string]string{}
	for _, r := range results {
		if _, ok := items[*r.OrgId]; !ok {
			items[*r.OrgId] = map[string]string{}
		}
		items[*r.OrgId][*r.Key] = r.Value
	}

	return items, err
}

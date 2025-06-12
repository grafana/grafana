package resource

import (
	"context"
	"fmt"
	"iter"
	"strings"

	"github.com/google/uuid"
)

const (
	prefixData = "/unified/data"
)

// dataStore is a data store that uses a KV store to store data.
type dataStore struct {
	kv KV
}

type dataListOptions struct {
	Limit int64
}

func newDataStore(kv KV) *dataStore {
	return &dataStore{
		kv: kv,
	}
}

type DataObj struct {
	Key   DataKey
	Value []byte
}

type DataKey struct {
	Namespace string
	Group     string
	Resource  string
	Name      string
	UUID      uuid.UUID
	IsDeleted bool
}

func (d *dataStore) getPrefix(key ListRequestKey) (string, error) {
	if key.Namespace == "" || key.Group == "" || key.Resource == "" {
		return "", fmt.Errorf("namespace, group, and resource are required")
	}
	if key.Name == "" {
		return fmt.Sprintf("%s/%s/%s/%s/", prefixData, key.Namespace, key.Group, key.Resource), nil
	}
	return fmt.Sprintf("%s/%s/%s/%s/%s/", prefixData, key.Namespace, key.Group, key.Resource, key.Name), nil
}

func (d *dataStore) getKey(key DataKey) string {
	if key.IsDeleted {
		return fmt.Sprintf("%s/%s/%s/%s/%s/%s-deleted", prefixData, key.Namespace, key.Group, key.Resource, key.Name, key.UUID.String())
	}
	return fmt.Sprintf("%s/%s/%s/%s/%s/%s", prefixData, key.Namespace, key.Group, key.Resource, key.Name, key.UUID.String())
}

func (d *dataStore) parseKey(key string) (DataKey, error) {
	// remove the prefix
	if !strings.HasPrefix(key, prefixData+"/") {
		return DataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	key = strings.TrimPrefix(key, prefixData+"/")

	parts := strings.Split(key, "/")
	if len(parts) <= 4 {
		return DataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	isDeleted := false
	if strings.HasSuffix(parts[4], "-deleted") {
		isDeleted = true
		parts[4] = strings.TrimSuffix(parts[4], "-deleted")
	}
	id, err := uuid.Parse(parts[4])
	if err != nil {
		return DataKey{}, fmt.Errorf("invalid uuid: %s", id)
	}
	return DataKey{
		Namespace: parts[0],
		Group:     parts[1],
		Resource:  parts[2],
		Name:      parts[3],
		UUID:      id,
		IsDeleted: isDeleted,
	}, nil
}

func (d *dataStore) List(ctx context.Context, key ListRequestKey) iter.Seq2[DataObj, error] {
	prefix, err := d.getPrefix(key)
	if err != nil {
		return func(yield func(DataObj, error) bool) {
			yield(DataObj{}, err)
		}
	}
	iter := d.kv.List(ctx, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	})
	return func(yield func(DataObj, error) bool) {
		for k, err := range iter {
			if err != nil {
				yield(DataObj{}, err)
				return
			}
			obj, err := d.kv.Get(ctx, k)
			if err != nil {
				yield(DataObj{}, err)
				return
			}
			key, err := d.parseKey(k)
			if err != nil {
				yield(DataObj{}, err)
				return
			}
			yield(DataObj{
				Key:   key,
				Value: obj.Value,
			}, nil)
		}
	}
}

func (d *dataStore) Get(ctx context.Context, key DataKey) ([]byte, error) {
	obj, err := d.kv.Get(ctx, d.getKey(key))
	if err != nil {
		return nil, err
	}
	return obj.Value, nil
}

func (d *dataStore) Save(ctx context.Context, key DataKey, value []byte) error {
	return d.kv.Save(ctx, d.getKey(key), value, SaveOptions{})
}

func (d *dataStore) Delete(ctx context.Context, key DataKey) error {
	return d.kv.Delete(ctx, d.getKey(key))
}

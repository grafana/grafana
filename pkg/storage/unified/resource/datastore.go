package resource

import (
	"context"
	"fmt"
	"iter"
	"strconv"
	"strings"
)

const (
	dataSection = "unified/data"
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
	Namespace       string
	Group           string
	Resource        string
	Name            string
	ResourceVersion int64
	Action          MetaDataAction
}

func (d *dataStore) getPrefix(key ListRequestKey) (string, error) {
	if key.Namespace == "" {
		// return "", fmt.Errorf("namespace is required") ???
		return "", nil
	}
	if key.Group == "" {
		return fmt.Sprintf("%s/", key.Namespace), nil
	}
	if key.Resource == "" {
		return fmt.Sprintf("%s/%s/", key.Namespace, key.Group), nil
	}
	if key.Name == "" {
		return fmt.Sprintf("%s/%s/%s/", key.Namespace, key.Group, key.Resource), nil
	}
	return fmt.Sprintf("%s/%s/%s/%s/", key.Namespace, key.Group, key.Resource, key.Name), nil
}

func (d *dataStore) getKey(key DataKey) string {
	return fmt.Sprintf("%s/%s/%s/%s/%d~%s", key.Namespace, key.Group, key.Resource, key.Name, key.ResourceVersion, key.Action)
}

func (d *dataStore) parseKey(key string) (DataKey, error) {
	parts := strings.Split(key, "/")
	if len(parts) <= 4 {
		return DataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	uidActionParts := strings.Split(parts[4], "~")
	if len(uidActionParts) != 2 {
		return DataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	rv, err := strconv.ParseInt(uidActionParts[0], 10, 64)
	if err != nil {
		return DataKey{}, fmt.Errorf("invalid resource version: %s", uidActionParts[0])
	}
	return DataKey{
		Namespace:       parts[0],
		Group:           parts[1],
		Resource:        parts[2],
		Name:            parts[3],
		ResourceVersion: rv,
		Action:          MetaDataAction(uidActionParts[1]),
	}, nil
}

func (d *dataStore) List(ctx context.Context, key ListRequestKey) iter.Seq2[DataObj, error] {
	prefix, err := d.getPrefix(key)
	if err != nil {
		return func(yield func(DataObj, error) bool) {
			yield(DataObj{}, err)
		}
	}
	iter := d.kv.Keys(ctx, dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	})
	return func(yield func(DataObj, error) bool) {
		for k, err := range iter {
			if err != nil {
				yield(DataObj{}, err)
				return
			}
			obj, err := d.kv.Get(ctx, dataSection, k)
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
	obj, err := d.kv.Get(ctx, dataSection, d.getKey(key))
	if err != nil {
		return nil, err
	}
	return obj.Value, nil
}

func (d *dataStore) Save(ctx context.Context, key DataKey, value []byte) error {
	return d.kv.Save(ctx, dataSection, d.getKey(key), value)
}

func (d *dataStore) Delete(ctx context.Context, key DataKey) error {
	return d.kv.Delete(ctx, dataSection, d.getKey(key))
}

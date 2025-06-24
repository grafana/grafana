package resource

import (
	"context"
	"fmt"
	"io"
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

func newDataStore(kv KV) *dataStore {
	return &dataStore{
		kv: kv,
	}
}

type DataObj struct {
	Key   DataKey
	Value io.ReadCloser
}

type DataKey struct {
	Namespace       string
	Group           string
	Resource        string
	Name            string
	ResourceVersion int64
	Action          MetaDataAction
}

// Keys returns all keys for a given key by iterating through the KV store
func (d *dataStore) Keys(ctx context.Context, key ListRequestKey) iter.Seq2[DataKey, error] {
	prefix := d.getPrefix(key)
	return func(yield func(DataKey, error) bool) {
		for k, err := range d.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: prefix,
			EndKey:   PrefixRangeEnd(prefix),
		}) {
			if err != nil {
				yield(DataKey{}, err)
				return
			}
			key, err := d.parseKey(k)
			if err != nil {
				yield(DataKey{}, err)
				return
			}
			if !yield(key, nil) {
				return
			}
		}
	}
}

func (d *dataStore) Get(ctx context.Context, key DataKey) (io.ReadCloser, error) {
	obj, err := d.kv.Get(ctx, dataSection, d.getKey(key))
	if err != nil {
		return nil, err
	}
	return obj.Value, nil
}

func (d *dataStore) Save(ctx context.Context, key DataKey, value io.ReadCloser) error {
	return d.kv.Save(ctx, dataSection, d.getKey(key), value)
}

func (d *dataStore) Delete(ctx context.Context, key DataKey) error {
	return d.kv.Delete(ctx, dataSection, d.getKey(key))
}

type ListHistoryRequest struct {
	Key   ListRequestKey
	Sort  SortOrder
	Limit int64
}

// ListHistory returns all history for a single resource by iterating through the KV store
func (d *dataStore) ListHistory(ctx context.Context, req ListHistoryRequest) iter.Seq2[DataObj, error] {
	if req.Key.Namespace == "" {
		return func(yield func(DataObj, error) bool) {
			yield(DataObj{}, fmt.Errorf("namespace is required"))
		}
	}
	if req.Key.Group == "" {
		return func(yield func(DataObj, error) bool) {
			yield(DataObj{}, fmt.Errorf("group is required"))
		}
	}
	if req.Key.Resource == "" {
		return func(yield func(DataObj, error) bool) {
			yield(DataObj{}, fmt.Errorf("resource is required"))
		}
	}
	if req.Key.Name == "" {
		return func(yield func(DataObj, error) bool) {
			yield(DataObj{}, fmt.Errorf("name is required"))
		}
	}
	return func(yield func(DataObj, error) bool) {
		prefix := d.getPrefix(req.Key)
		iter := d.kv.Keys(ctx, dataSection, ListOptions{
			Sort:     req.Sort,
			StartKey: prefix,
			EndKey:   PrefixRangeEnd(prefix),
			Limit:    req.Limit,
		})
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

func (d *dataStore) getPrefix(key ListRequestKey) string {
	if key.Namespace == "" {
		return ""
	}
	if key.Group == "" {
		return fmt.Sprintf("%s/", key.Namespace)
	}
	if key.Resource == "" {
		return fmt.Sprintf("%s/%s/", key.Namespace, key.Group)
	}
	if key.Name == "" {
		return fmt.Sprintf("%s/%s/%s/", key.Namespace, key.Group, key.Resource)
	}
	return fmt.Sprintf("%s/%s/%s/%s/", key.Namespace, key.Group, key.Resource, key.Name)
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

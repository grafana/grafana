package kvstore

import (
	"context"
	"errors"
	"strings"
)

// In memory kv store used for testing
type FakeKVStore struct {
	store    map[Key]string
	delError bool
}

func NewFakeKVStore() *FakeKVStore {
	return &FakeKVStore{store: make(map[Key]string)}
}

func (f *FakeKVStore) DeletionError(shouldErr bool) {
	f.delError = shouldErr
}

func (f *FakeKVStore) Get(ctx context.Context, orgId int64, namespace string, key string) (string, bool, error) {
	value := f.store[buildKey(orgId, namespace, key)]
	found := value != ""
	return value, found, nil
}

func (f *FakeKVStore) Set(ctx context.Context, orgId int64, namespace string, key string, value string) error {
	f.store[buildKey(orgId, namespace, key)] = value
	return nil
}

func (f *FakeKVStore) Del(ctx context.Context, orgId int64, namespace string, key string) error {
	if f.delError {
		return errors.New("mocked del error")
	}
	delete(f.store, buildKey(orgId, namespace, key))
	return nil
}

// List all keys with an optional filter. If default values are provided, filter is not applied.
func (f *FakeKVStore) Keys(ctx context.Context, orgId int64, namespace string, keyPrefix string) ([]Key, error) {
	res := make([]Key, 0)
	for k := range f.store {
		if orgId == AllOrganizations && namespace == "" && keyPrefix == "" {
			res = append(res, k)
		} else if k.OrgId == orgId && k.Namespace == namespace && strings.HasPrefix(k.Key, keyPrefix) {
			res = append(res, k)
		}
	}
	return res, nil
}

func (f *FakeKVStore) GetAll(ctx context.Context, orgId int64, namespace string) (map[int64]map[string]string, error) {
	items := make(map[int64]map[string]string)
	for k := range f.store {
		orgId := k.OrgId
		namespace := k.Namespace

		if _, ok := items[orgId]; !ok {
			items[orgId] = make(map[string]string)
		}

		items[orgId][namespace] = f.store[k]
	}

	return items, nil
}

func buildKey(orgId int64, namespace string, key string) Key {
	return Key{
		OrgId:     orgId,
		Namespace: namespace,
		Key:       key,
	}
}

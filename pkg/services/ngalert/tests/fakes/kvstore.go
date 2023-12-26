package fakes

import (
	"context"
	"strings"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/infra/kvstore"
)

type FakeKVStore struct {
	Mtx   sync.Mutex
	Store map[int64]map[string]map[string]string
}

func NewFakeKVStore(t *testing.T) *FakeKVStore {
	t.Helper()

	return &FakeKVStore{
		Store: map[int64]map[string]map[string]string{},
	}
}

func (fkv *FakeKVStore) Get(_ context.Context, orgId int64, namespace string, key string) (string, bool, error) {
	fkv.Mtx.Lock()
	defer fkv.Mtx.Unlock()
	org, ok := fkv.Store[orgId]
	if !ok {
		return "", false, nil
	}
	k, ok := org[namespace]
	if !ok {
		return "", false, nil
	}

	v, ok := k[key]
	if !ok {
		return "", false, nil
	}

	return v, true, nil
}
func (fkv *FakeKVStore) Set(_ context.Context, orgId int64, namespace string, key string, value string) error {
	fkv.Mtx.Lock()
	defer fkv.Mtx.Unlock()
	org, ok := fkv.Store[orgId]
	if !ok {
		fkv.Store[orgId] = map[string]map[string]string{}
	}
	_, ok = org[namespace]
	if !ok {
		fkv.Store[orgId][namespace] = map[string]string{}
	}

	fkv.Store[orgId][namespace][key] = value

	return nil
}
func (fkv *FakeKVStore) Del(_ context.Context, orgId int64, namespace string, key string) error {
	fkv.Mtx.Lock()
	defer fkv.Mtx.Unlock()
	org, ok := fkv.Store[orgId]
	if !ok {
		return nil
	}
	_, ok = org[namespace]
	if !ok {
		return nil
	}

	delete(fkv.Store[orgId][namespace], key)

	return nil
}

func (fkv *FakeKVStore) Keys(ctx context.Context, orgID int64, namespace string, keyPrefix string) ([]kvstore.Key, error) {
	fkv.Mtx.Lock()
	defer fkv.Mtx.Unlock()
	var keys []kvstore.Key
	for orgIDFromStore, namespaceMap := range fkv.Store {
		if orgID != kvstore.AllOrganizations && orgID != orgIDFromStore {
			continue
		}
		if keyMap, exists := namespaceMap[namespace]; exists {
			for k := range keyMap {
				if strings.HasPrefix(k, keyPrefix) {
					keys = append(keys, kvstore.Key{
						OrgId:     orgIDFromStore,
						Namespace: namespace,
						Key:       keyPrefix,
					})
				}
			}
		}
	}
	return keys, nil
}

func (fkv *FakeKVStore) GetAll(ctx context.Context, orgId int64, namespace string) (map[int64]map[string]string, error) {
	fkv.Mtx.Lock()
	defer fkv.Mtx.Unlock()

	all := map[int64]map[string]string{
		orgId: make(map[string]string),
	}

	org, ok := fkv.Store[orgId]
	if !ok {
		return nil, nil
	}

	values, ok := org[namespace]
	if !ok {
		return all, nil
	}

	for k, v := range values {
		all[orgId][k] = v
	}
	return all, nil
}

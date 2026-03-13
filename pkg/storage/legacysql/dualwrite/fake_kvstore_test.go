package dualwrite

import (
	"context"
	"sync"
)

type fakeKVKey struct {
	orgID     int64
	namespace string
	key       string
}

type fakeKVStore struct {
	mu    sync.RWMutex
	store map[fakeKVKey]string
}

func newFakeKVStore() *fakeKVStore {
	return &fakeKVStore{store: make(map[fakeKVKey]string)}
}

func (f *fakeKVStore) Get(_ context.Context, orgID int64, namespace string, key string) (string, bool, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	value, ok := f.store[fakeKVKey{orgID: orgID, namespace: namespace, key: key}]
	return value, ok, nil
}

func (f *fakeKVStore) Set(_ context.Context, orgID int64, namespace string, key string, value string) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.store[fakeKVKey{orgID: orgID, namespace: namespace, key: key}] = value
	return nil
}

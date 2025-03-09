package fakes

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
)

type FakeEncryptionStore struct {
	store map[string]*encryption.DataKey
}

func NewFakeEncryptionStore() FakeEncryptionStore {
	return FakeEncryptionStore{store: make(map[string]*encryption.DataKey)}
}

func (f FakeEncryptionStore) GetDataKey(_ context.Context, id string) (*encryption.DataKey, error) {
	key, ok := f.store[id]
	if !ok {
		return nil, encryptionstorage.ErrDataKeyNotFound
	}

	return key, nil
}

func (f FakeEncryptionStore) GetCurrentDataKey(_ context.Context, label string) (*encryption.DataKey, error) {
	for _, key := range f.store {
		if key.Label == label && key.Active {
			return key, nil
		}
	}

	return nil, encryptionstorage.ErrDataKeyNotFound
}

func (f FakeEncryptionStore) GetAllDataKeys(_ context.Context) ([]*encryption.DataKey, error) {
	result := make([]*encryption.DataKey, 0)
	for _, key := range f.store {
		result = append(result, key)
	}
	return result, nil
}

func (f FakeEncryptionStore) CreateDataKey(_ context.Context, dataKey *encryption.DataKey) error {
	f.store[dataKey.UID] = dataKey
	return nil
}

func (f FakeEncryptionStore) DisableDataKeys(_ context.Context) error {
	for id := range f.store {
		f.store[id].Active = false
	}
	return nil
}

func (f FakeEncryptionStore) DeleteDataKey(_ context.Context, id string) error {
	delete(f.store, id)
	return nil
}

func (f FakeEncryptionStore) ReEncryptDataKeys(_ context.Context, _ map[encryption.ProviderID]encryption.Provider, _ encryption.ProviderID) error {
	return nil
}

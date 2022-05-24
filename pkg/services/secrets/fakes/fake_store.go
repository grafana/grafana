package fakes

import (
	"context"

	"github.com/grafana/grafana/pkg/services/secrets"
	"xorm.io/xorm"
)

type FakeSecretsStore struct {
	store map[string]*secrets.DataKey
}

func NewFakeSecretsStore() FakeSecretsStore {
	return FakeSecretsStore{store: make(map[string]*secrets.DataKey)}
}

func (f FakeSecretsStore) GetDataKey(_ context.Context, id string) (*secrets.DataKey, error) {
	key, ok := f.store[id]
	if !ok {
		return nil, secrets.ErrDataKeyNotFound
	}

	return key, nil
}

func (f FakeSecretsStore) GetCurrentDataKey(_ context.Context, name string) (*secrets.DataKey, error) {
	for _, key := range f.store {
		if key.Name == name && key.Active {
			return key, nil
		}
	}

	return nil, secrets.ErrDataKeyNotFound
}

func (f FakeSecretsStore) GetAllDataKeys(_ context.Context) ([]*secrets.DataKey, error) {
	result := make([]*secrets.DataKey, 0)
	for _, key := range f.store {
		result = append(result, key)
	}
	return result, nil
}

func (f FakeSecretsStore) CreateDataKey(_ context.Context, dataKey *secrets.DataKey) error {
	f.store[dataKey.Id] = dataKey
	return nil
}

func (f FakeSecretsStore) CreateDataKeyWithDBSession(_ context.Context, dataKey *secrets.DataKey, _ *xorm.Session) error {
	f.store[dataKey.Id] = dataKey
	return nil
}

func (f FakeSecretsStore) DisableDataKeys(_ context.Context) error {
	for id := range f.store {
		f.store[id].Active = false
	}
	return nil
}

func (f FakeSecretsStore) DeleteDataKey(_ context.Context, id string) error {
	delete(f.store, id)
	return nil
}

func (f FakeSecretsStore) ReEncryptDataKeys(_ context.Context, _ map[secrets.ProviderID]secrets.Provider, _ secrets.ProviderID) error {
	return nil
}

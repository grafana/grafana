package fakes

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/services/secrets"
)

type FakeSecretsStore struct {
	store map[string]*secrets.DataKey
}

func NewFakeSecretsStore() FakeSecretsStore {
	return FakeSecretsStore{store: make(map[string]*secrets.DataKey)}
}

func (f FakeSecretsStore) GetDataKey(_ context.Context, name string) (*secrets.DataKey, error) {
	key, ok := f.store[name]
	if !ok {
		return nil, secrets.ErrDataKeyNotFound
	}
	return key, nil
}

func (f FakeSecretsStore) GetAllDataKeys(_ context.Context) ([]*secrets.DataKey, error) {
	result := make([]*secrets.DataKey, 0)
	for _, key := range f.store {
		result = append(result, key)
	}
	return result, nil
}

func (f FakeSecretsStore) CreateDataKey(_ context.Context, dataKey secrets.DataKey) error {
	f.store[dataKey.Name] = &dataKey
	return nil
}

func (f FakeSecretsStore) CreateDataKeyWithDBSession(_ context.Context, dataKey secrets.DataKey, _ *sqlstore.DBSession) error {
	f.store[dataKey.Name] = &dataKey
	return nil
}

func (f FakeSecretsStore) DeleteDataKey(_ context.Context, name string) error {
	delete(f.store, name)
	return nil
}

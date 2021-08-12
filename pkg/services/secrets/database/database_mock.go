package database

import (
	"context"

	"github.com/grafana/grafana/pkg/services/secrets/types"
)

type SecretsStoreMock struct {
	store map[string]*types.DataKey
}

func (m *SecretsStoreMock) GetDataKey(ctx context.Context, name string) (*types.DataKey, error) {
	key, ok := m.store[name]
	if !ok {
		return nil, types.ErrDataKeyNotFound
	}
	return key, nil
}

func (m *SecretsStoreMock) GetAllDataKeys(ctx context.Context) ([]*types.DataKey, error) {
	result := make([]*types.DataKey, 0)
	for _, key := range m.store {
		result = append(result, key)
	}
	return result, nil
}

func (m *SecretsStoreMock) CreateDataKey(ctx context.Context, dataKey types.DataKey) error {
	m.store[dataKey.Name] = &dataKey
	return nil
}

func (m *SecretsStoreMock) DeleteDataKey(ctx context.Context, name string) error {
	delete(m.store, name)
	return nil
}

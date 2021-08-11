package secrets

import (
	"context"

	"github.com/grafana/grafana/pkg/services/secrets/types"
)

type SecretsStore interface {
	GetDataKey(ctx context.Context, name string) (*types.DataKey, error)
	GetAllDataKeys(ctx context.Context) ([]*types.DataKey, error)
	CreateDataKey(ctx context.Context, dataKey types.DataKey) error
	DeleteDataKey(ctx context.Context, name string) error
}

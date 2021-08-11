package database

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/secrets/types"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

const dataKeysTable = "data_keys"

type SecretsStoreImpl struct {
	SQLStore *sqlstore.SQLStore `inject:""`
}

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "SecretsStore",
		Instance:     &SecretsStoreImpl{},
		InitPriority: registry.High,
	})
}

func (ss *SecretsStoreImpl) Init() error {
	return nil
}

func (ss *SecretsStoreImpl) GetDataKey(ctx context.Context, name string) (*types.DataKey, error) {
	dataKey := &types.DataKey{}
	var exists bool

	err := ss.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		ex, err := sess.Table(dataKeysTable).
			Where("name = ? AND active = ?", name, ss.SQLStore.Dialect.BooleanStr(true)).
			Get(dataKey)
		exists = ex
		return err
	})

	if !exists {
		return nil, types.ErrDataKeyNotFound
	}

	if err != nil {
		// s.log.Error("Failed getting data key", "err", err, "name", name)
		return nil, fmt.Errorf("failed getting data key: %w", err)
	}

	return dataKey, nil
}

func (ss *SecretsStoreImpl) GetAllDataKeys(ctx context.Context) ([]*types.DataKey, error) {
	result := make([]*types.DataKey, 0)
	err := ss.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		err := sess.Table(dataKeysTable).Find(&result)
		return err
	})
	return result, err
}

func (ss *SecretsStoreImpl) CreateDataKey(ctx context.Context, dataKey types.DataKey) error {
	if !dataKey.Active {
		return fmt.Errorf("cannot insert deactivated data keys")
	}

	dataKey.Created = time.Now()
	dataKey.Updated = dataKey.Created

	err := ss.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Table(dataKeysTable).Insert(&dataKey)
		return err
	})

	return err
}

func (ss *SecretsStoreImpl) DeleteDataKey(ctx context.Context, name string) error {
	return ss.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Table(dataKeysTable).Delete(&types.DataKey{Name: name})

		return err
	})
}

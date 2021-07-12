package sqlstore

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"xorm.io/xorm"
)

const dataKeysTable = "data_keys"

func (ss *SqlStore) GetDataKey(ctx context.Context, name string) (*models.DataKey, error) {
	return getDataKey(ctx, name, ss.engine)
}

func (ss *SqlStore) CreateDataKey(ctx context.Context, dataKey models.DataKey) error {
	dataKey.Created = time.Now()
	dataKey.Updated = dataKey.Created

	if !dataKey.Active {
		return fmt.Errorf("cannot insert deactivated data keys")
	}

	_, err := ss.engine.Context(ctx).Table(dataKeysTable).InsertOne(dataKey)
	return err
}

func (ss *SqlStore) DeleteDataKey(ctx context.Context, name string) error {
	_, err := ss.engine.Context(ctx).Table(dataKeysTable).Delete(models.DataKey{Name: name})
	return err
}

func getDataKey(ctx context.Context, name string, engine *xorm.Engine) (*models.DataKey, error) {
	dataKey := &models.DataKey{Name: name, Active: true}
	exists, err := engine.Context(ctx).Table(dataKeysTable).Get(dataKey)

	if err != nil {
		sqlog.Error("Failed getting data key", "err", err, "name", name)
		return nil, fmt.Errorf("failed getting data key: %w", err)
	}
	if !exists {
		return nil, models.ErrDataKeyNotFound
	}

	return dataKey, nil
}

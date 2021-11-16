package database

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"xorm.io/xorm"
)

const dataKeysTable = "data_keys"

var logger = log.New("secrets-store")

type SecretsStoreImpl struct {
	sqlStore *sqlstore.SQLStore
}

func ProvideSecretsStore(sqlStore *sqlstore.SQLStore) *SecretsStoreImpl {
	return &SecretsStoreImpl{
		sqlStore: sqlStore,
	}
}

func (ss *SecretsStoreImpl) GetDataKey(ctx context.Context, name string) (*secrets.DataKey, error) {
	dataKey := &secrets.DataKey{}
	var exists bool

	err := ss.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var err error
		exists, err = sess.Table(dataKeysTable).
			Where("name = ? AND active = ?", name, ss.sqlStore.Dialect.BooleanStr(true)).
			Get(dataKey)
		return err
	})

	if !exists {
		return nil, secrets.ErrDataKeyNotFound
	}

	if err != nil {
		logger.Error("Failed getting data key", "err", err, "name", name)
		return nil, fmt.Errorf("failed getting data key: %w", err)
	}

	return dataKey, nil
}

func (ss *SecretsStoreImpl) GetAllDataKeys(ctx context.Context) ([]*secrets.DataKey, error) {
	result := make([]*secrets.DataKey, 0)
	err := ss.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		err := sess.Table(dataKeysTable).Find(&result)
		return err
	})
	return result, err
}

func (ss *SecretsStoreImpl) CreateDataKey(ctx context.Context, dataKey secrets.DataKey) error {
	return ss.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return ss.CreateDataKeyWithDBSession(ctx, dataKey, sess.Session)
	})
}

func (ss *SecretsStoreImpl) CreateDataKeyWithDBSession(_ context.Context, dataKey secrets.DataKey, sess *xorm.Session) error {
	if !dataKey.Active {
		return fmt.Errorf("cannot insert deactivated data keys")
	}

	dataKey.Created = time.Now()
	dataKey.Updated = dataKey.Created

	_, err := sess.Table(dataKeysTable).Insert(&dataKey)
	return err
}

func (ss *SecretsStoreImpl) DeleteDataKey(ctx context.Context, name string) error {
	if len(name) == 0 {
		return fmt.Errorf("data key name is missing")
	}

	return ss.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Table(dataKeysTable).Delete(&secrets.DataKey{Name: name})

		return err
	})
}

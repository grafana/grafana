package secrets

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/secrets/types"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

const dataKeysTable = "data_keys"

var logger = log.New("secrets-store")

func (s *SecretsService) GetDataKey(ctx context.Context, name string) (*types.DataKey, error) {
	dataKey := &types.DataKey{}
	var exists bool

	err := s.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var err error
		exists, err = sess.Table(dataKeysTable).
			Where("name = ? AND active = ?", name, s.sqlStore.Dialect.BooleanStr(true)).
			Get(dataKey)
		return err
	})

	if !exists {
		return nil, types.ErrDataKeyNotFound
	}

	if err != nil {
		logger.Error("Failed getting data key", "err", err, "name", name)
		return nil, fmt.Errorf("failed getting data key: %w", err)
	}

	return dataKey, nil
}

func (s *SecretsService) GetAllDataKeys(ctx context.Context) ([]*types.DataKey, error) {
	result := make([]*types.DataKey, 0)
	err := s.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		err := sess.Table(dataKeysTable).Find(&result)
		return err
	})
	return result, err
}

func (s *SecretsService) CreateDataKey(ctx context.Context, dataKey types.DataKey) error {
	return s.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return s.CreateDataKeyWithDBSession(ctx, dataKey, sess)
	})
}

func (s *SecretsService) CreateDataKeyWithDBSession(_ context.Context, dataKey types.DataKey, sess *sqlstore.DBSession) error {
	if !dataKey.Active {
		return fmt.Errorf("cannot insert deactivated data keys")
	}

	dataKey.Created = time.Now()
	dataKey.Updated = dataKey.Created

	_, err := sess.Table(dataKeysTable).Insert(&dataKey)
	return err
}

func (s *SecretsService) DeleteDataKey(ctx context.Context, name string) error {
	if len(name) == 0 {
		return fmt.Errorf("data key name is missing")
	}

	return s.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Table(dataKeysTable).Delete(&types.DataKey{Name: name})

		return err
	})
}

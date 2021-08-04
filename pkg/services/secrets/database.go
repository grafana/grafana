package secrets

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

const dataKeysTable = "data_keys"

func (s *SecretsService) GetDataKey(ctx context.Context, name string) (*DataKey, error) {
	dataKey := &DataKey{}
	var exists bool

	err := s.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		ex, err := sess.Table(dataKeysTable).
			Where("name = ? AND active = ?", name, s.SQLStore.Dialect.BooleanStr(true)).
			Get(dataKey)
		exists = ex
		return err
	})

	if !exists {
		return nil, ErrDataKeyNotFound
	}

	if err != nil {
		s.log.Error("Failed getting data key", "err", err, "name", name)
		return nil, fmt.Errorf("failed getting data key: %w", err)
	}

	return dataKey, nil
}

func (s *SecretsService) CreateDataKey(ctx context.Context, dataKey DataKey) error {
	if !dataKey.Active {
		return fmt.Errorf("cannot insert deactivated data keys")
	}

	dataKey.Created = time.Now()
	dataKey.Updated = dataKey.Created

	err := s.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Table(dataKeysTable).Insert(&dataKey)
		return err
	})

	return err
}

func (s *SecretsService) DeleteDataKey(ctx context.Context, name string) error {
	return s.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Table(dataKeysTable).Delete(&DataKey{Name: name})

		return err
	})
}

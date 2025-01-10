package secret

import (
	"context"
	"fmt"
	"time"
	"uuid"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type encryptedValueStorage struct {
	db db.DB
}

func (s *encryptedValueStorage) Create(ctx context.Context, encryptedData []byte) (*encryptedValueDB, error) {
	creationTime := time.Now().Unix()
	row := &encryptedValueDB{UID: uuid.New().String(), EncryptedData: encryptedData, Created: creationTime, Updated: creationTime}

	err := s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Insert(row); err != nil {
			return fmt.Errorf("insert row: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	return nil, nil
}

func (s *encryptedValueStorage) Get(ctx context.Context, uid string) (*encryptedValueDB, error) {
	// TODO: implement me
	return nil, nil
}

func (s *encryptedValueStorage) Update(ctx context.Context, encryptedData []byte) (*encryptedValueDB, error) {
	// TODO: implement me
	return nil, nil
}

func (s *encryptedValueStorage) Delete(ctx context.Context, uid string) error {
	// TODO: implement me
	return nil
}

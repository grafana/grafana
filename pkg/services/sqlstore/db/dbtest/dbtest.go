package dbtest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/jmoiron/sqlx"
)

type FakeDB struct {
	ExpectedError error
}

func NewFakeDB() *FakeDB {
	return &FakeDB{}
}

func (f *FakeDB) WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return f.ExpectedError
}

func (ss *FakeDB) GetSQLXDB() *sqlx.DB {
	return nil
}

func (f *FakeDB) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return f.ExpectedError
}

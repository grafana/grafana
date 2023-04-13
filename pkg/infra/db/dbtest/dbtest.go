package dbtest

import (
	"context"

	"xorm.io/core"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
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

func (f *FakeDB) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return f.ExpectedError
}

func (f *FakeDB) WithNewDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return f.ExpectedError
}

func (f *FakeDB) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return f.ExpectedError
}

func (f *FakeDB) GetDBType() core.DbType {
	return ""
}

func (f *FakeDB) GetDialect() migrator.Dialect {
	return nil
}

func (f *FakeDB) GetSqlxSession() *session.SessionDB {
	return nil
}

func (f *FakeDB) Quote(value string) string {
	return ""
}

func (f *FakeDB) RecursiveQueriesAreSupported() (bool, error) {
	return false, nil
}

// TODO: service-specific methods not yet split out ; to be removed
func (f *FakeDB) UpdateTempUserWithEmailSent(ctx context.Context, cmd *tempuser.UpdateTempUserWithEmailSentCommand) error {
	return f.ExpectedError
}

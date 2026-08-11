package apikeyimpl

import (
	"context"
	"regexp"
	"sync"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

func TestIntegrationXORMApiKeyDataAccess(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testIntegrationApiKeyDataAccess(t, func(ss db.DB) store {
		return &sqlStore{sql: legacysql.NewDatabaseProvider(ss)}
	})
}

var registerAPIKeySQLMockXormDriverOnce sync.Once

type apiKeySQLMockXormDriver struct{}

func (apiKeySQLMockXormDriver) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{DbType: core.SQLITE}, nil
}

type sqlmockAPIKeyDB struct {
	dbtest.FakeDB
	engine *xorm.Engine
}

func (d *sqlmockAPIKeyDB) WithDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.withSession(callback)
}

func (d *sqlmockAPIKeyDB) WithTransactionalDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.withSession(callback)
}

func (d *sqlmockAPIKeyDB) withSession(callback sqlstore.DBTransactionFunc) error {
	sess := &sqlstore.DBSession{Session: d.engine.NewSession()}
	defer sess.Close()
	return callback(sess)
}

func (d *sqlmockAPIKeyDB) GetDBType() core.DbType {
	return core.SQLITE
}

func (d *sqlmockAPIKeyDB) GetDialect() migrator.Dialect {
	return migrator.NewSQLite3Dialect()
}

func (d *sqlmockAPIKeyDB) Quote(value string) string {
	return d.engine.Quote(value)
}

func TestStoreUsesProviderTables(t *testing.T) {
	registerAPIKeySQLMockXormDriverOnce.Do(func() {
		if core.QueryDriver("sqlmock") == nil {
			core.RegisterDriver("sqlmock", apiKeySQLMockXormDriver{})
		}
	})

	dsn := "apikeyimpl-store"
	mockDB, mock, err := sqlmock.NewWithDSN(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = mockDB.Close() })

	engine, err := xorm.NewEngine("sqlmock", dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })

	legacyDB := &sqlmockAPIKeyDB{engine: engine}
	type contextKey struct{}
	ctx := context.WithValue(context.Background(), contextKey{}, "provider context")
	calls := 0
	provider := func(gotCtx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		require.Equal(t, "provider context", gotCtx.Value(contextKey{}))
		calls++
		return &legacysql.LegacyDatabaseHelper{
			DB: legacyDB,
			Table: func(name string) string {
				return "test_schema." + name
			},
		}, nil
	}
	store := &sqlStore{sql: provider}

	mock.ExpectQuery(regexp.QuoteMeta("FROM `test_schema`.`api_key`")).
		WithArgs("hash").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(7)))
	_, err = store.GetAPIKeyByHash(ctx, "hash")
	require.NoError(t, err)

	mock.ExpectExec(regexp.QuoteMeta("UPDATE `test_schema`.`api_key` SET")).
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, store.UpdateAPIKeyLastUsedDate(ctx, 7))

	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*) AS count FROM `test_schema`.`api_key`")).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(3)))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*) AS count FROM `test_schema`.`api_key` WHERE org_id = ?")).
		WithArgs(int64(1)).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(2)))
	_, err = store.Count(ctx, &quota.ScopeParameters{OrgID: 1})
	require.NoError(t, err)

	require.Equal(t, 3, calls)
	require.NoError(t, mock.ExpectationsWereMet())
}

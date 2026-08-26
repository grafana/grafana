package database

import (
	"context"
	"errors"
	"regexp"
	"sync"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

var registerSSOSQLMockXormDriverOnce sync.Once

type ssoSQLMockXormDriver struct{}

func (ssoSQLMockXormDriver) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{DbType: core.SQLITE}, nil
}

type sqlmockSSODB struct {
	dbtest.FakeDB
	engine *xorm.Engine
}

func (d *sqlmockSSODB) WithDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	sess := &sqlstore.DBSession{Session: d.engine.NewSession()}
	defer sess.Close()
	return callback(sess)
}

func (d *sqlmockSSODB) WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.WithDbSession(ctx, callback)
}

func (d *sqlmockSSODB) GetDBType() core.DbType {
	return core.SQLITE
}

func (d *sqlmockSSODB) GetDialect() migrator.Dialect {
	return migrator.NewSQLite3Dialect()
}

func (d *sqlmockSSODB) Quote(value string) string {
	return d.engine.Quote(value)
}

func TestStoreUsesProviderTables(t *testing.T) {
	registerSSOSQLMockXormDriverOnce.Do(func() {
		if core.QueryDriver("sqlmock") == nil {
			core.RegisterDriver("sqlmock", ssoSQLMockXormDriver{})
		}
	})

	dsn := "ssosettings-database-store"
	mockDB, mock, err := sqlmock.NewWithDSN(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = mockDB.Close() })

	engine, err := xorm.NewEngine("sqlmock", dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })

	legacyDB := &sqlmockSSODB{engine: engine}
	type contextKey struct{}
	ctx := context.WithValue(context.Background(), contextKey{}, "provider context")
	providerCalls := 0
	provider := func(gotCtx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		require.Equal(t, "provider context", gotCtx.Value(contextKey{}))
		providerCalls++
		return &legacysql.LegacyDatabaseHelper{
			DB: legacyDB,
			Table: func(name string) string {
				return "test_schema." + name
			},
		}, nil
	}
	store := ProvideStore(provider)

	mock.ExpectQuery(regexp.QuoteMeta("FROM `test_schema`.`sso_setting`")).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	_, err = store.Get(ctx, "github")
	require.ErrorIs(t, err, ssosettings.ErrNotFound)

	mock.ExpectQuery(regexp.QuoteMeta("FROM `test_schema`.`sso_setting`")).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	settings, err := store.List(ctx)
	require.NoError(t, err)
	require.Empty(t, settings)

	mock.ExpectQuery(regexp.QuoteMeta("FROM `test_schema`.`sso_setting`")).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `test_schema`.`sso_setting`")).
		WillReturnResult(sqlmock.NewResult(0, 1))
	err = store.Upsert(ctx, &models.SSOSettings{
		Provider: "github",
		Settings: map[string]any{"enabled": true},
	})
	require.NoError(t, err)

	mock.ExpectQuery(regexp.QuoteMeta("FROM `test_schema`.`sso_setting`")).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	err = store.Delete(ctx, "github")
	require.ErrorIs(t, err, ssosettings.ErrNotFound)

	require.Equal(t, 4, providerCalls)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestStoreReturnsProviderErrorBeforeDatabaseAccess(t *testing.T) {
	providerErr := errors.New("provider unavailable")
	store := ProvideStore(func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return nil, providerErr
	})

	_, err := store.List(context.Background())
	require.ErrorIs(t, err, providerErr)
}

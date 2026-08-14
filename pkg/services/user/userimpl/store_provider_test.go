package userimpl

import (
	"context"
	"regexp"
	"sync"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

var registerUserSQLMockXormDriverOnce sync.Once

type userSQLMockXormDriver struct{}

func (userSQLMockXormDriver) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{DbType: core.SQLITE}, nil
}

type sqlmockUserDB struct {
	dbtest.FakeDB
	engine *xorm.Engine
}

func (d *sqlmockUserDB) WithDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	sess := &sqlstore.DBSession{Session: d.engine.NewSession()}
	defer sess.Close()
	return callback(sess)
}

func (d *sqlmockUserDB) WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.WithDbSession(ctx, callback)
}

func (d *sqlmockUserDB) GetDBType() core.DbType {
	return core.SQLITE
}

func (d *sqlmockUserDB) GetDialect() migrator.Dialect {
	return migrator.NewSQLite3Dialect()
}

func (d *sqlmockUserDB) Quote(value string) string {
	return d.engine.Quote(value)
}

func TestStoreUsesProviderTables(t *testing.T) {
	registerUserSQLMockXormDriverOnce.Do(func() {
		if core.QueryDriver("sqlmock") == nil {
			core.RegisterDriver("sqlmock", userSQLMockXormDriver{})
		}
	})

	dsn := "userimpl-store"
	mockDB, mock, err := sqlmock.NewWithDSN(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = mockDB.Close() })

	engine, err := xorm.NewEngine("sqlmock", dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })

	legacyDB := &sqlmockUserDB{engine: engine}
	type contextKey struct{}
	ctx := context.WithValue(context.Background(), contextKey{}, "provider context")
	providerCalls := 0
	resolvedTables := make([]string, 0)
	provider := func(gotCtx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		require.Equal(t, "provider context", gotCtx.Value(contextKey{}))
		providerCalls++
		return &legacysql.LegacyDatabaseHelper{
			DB: legacyDB,
			Table: func(name string) string {
				resolvedTables = append(resolvedTables, name)
				return "test_schema." + name
			},
		}, nil
	}
	store := ProvideStore(provider, nil)

	mock.ExpectQuery(`(?s).*FROM .*test_schema.*user.*uid = \?`).
		WithArgs("user-uid").
		WillReturnRows(sqlmock.NewRows([]string{"id", "uid"}).AddRow(int64(7), "user-uid"))
	got, err := store.GetByUID(ctx, "user-uid")
	require.NoError(t, err)
	require.Equal(t, int64(7), got.ID)

	mock.ExpectExec(`(?s)INSERT INTO .*test_schema.*user.*`).
		WillReturnResult(sqlmock.NewResult(11, 1))
	insertedID, err := store.Insert(ctx, &user.User{Email: "inserted@example.com", Login: "inserted"})
	require.NoError(t, err)
	require.Equal(t, int64(11), insertedID)

	mock.ExpectExec(regexp.QuoteMeta("DELETE FROM `test_schema`.`user` WHERE id = ?")).
		WithArgs(int64(7)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, store.Delete(ctx, 7))

	mock.ExpectExec(`(?s)UPDATE .*test_schema.*user.*SET is_disabled=\?.*WHERE Id IN \(\?,\?\).*is_service_account`).
		WithArgs(true, int64(7), int64(11)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, store.BatchDisableUsers(ctx, &user.BatchDisableUsersCommand{
		UserIDs: []int64{7, 11}, IsDisabled: true,
	}))

	mock.ExpectQuery(`(?s).*FROM .*test_schema.*user.*LEFT OUTER JOIN .*test_schema.*org_user.*LEFT OUTER JOIN .*test_schema.*org.*WHERE u.id=\?`).
		WithArgs(int64(42), int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow(int64(7)))
	signedInUser, err := store.GetSignedInUser(ctx, &user.GetSignedInUserQuery{UserID: 7, OrgID: 42})
	require.NoError(t, err)
	require.Equal(t, int64(7), signedInUser.UserID)

	require.Equal(t, 5, providerCalls)
	require.Contains(t, resolvedTables, "user")
	require.Contains(t, resolvedTables, "org_user")
	require.Contains(t, resolvedTables, "org")
	require.NoError(t, mock.ExpectationsWereMet())
}

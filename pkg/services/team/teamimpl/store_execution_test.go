package teamimpl

import (
	"context"
	"regexp"
	"sync"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

var registerTeamSQLMockXormDriverOnce sync.Once

type teamSQLMockXormDriver struct{}

func (teamSQLMockXormDriver) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{DbType: core.SQLITE}, nil
}

type sqlmockTeamDB struct {
	dbtest.FakeDB
	engine *xorm.Engine
}

func (d *sqlmockTeamDB) WithDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.withSession(callback)
}

func (d *sqlmockTeamDB) WithTransactionalDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.withSession(callback)
}

func (d *sqlmockTeamDB) withSession(callback sqlstore.DBTransactionFunc) error {
	sess := &sqlstore.DBSession{Session: d.engine.NewSession()}
	defer sess.Close()
	return callback(sess)
}

func (d *sqlmockTeamDB) GetDBType() core.DbType {
	return core.SQLITE
}

type providerContextKey struct{}

// newProviderForTable returns a provider that asserts it is resolved with the
// operation context and qualifies tables with a test schema.
func newProviderForTable(t *testing.T, legacyDB db.DB, calls *int) legacysql.LegacyDatabaseProvider {
	return func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		require.Equal(t, "provider context", ctx.Value(providerContextKey{}),
			"store must resolve the provider with the operation context, not a fabricated helper")
		*calls++
		return &legacysql.LegacyDatabaseHelper{
			DB: legacyDB,
			Table: func(name string) string {
				return "test_schema." + name
			},
		}, nil
	}
}

func newSQLMockTeamStore(t *testing.T) (*xormStore, sqlmock.Sqlmock, *int) {
	t.Helper()
	registerTeamSQLMockXormDriverOnce.Do(func() {
		if core.QueryDriver("sqlmock") == nil {
			core.RegisterDriver("sqlmock", teamSQLMockXormDriver{})
		}
	})

	dsn := "team-store"
	mockDB, mock, err := sqlmock.NewWithDSN(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = mockDB.Close() })

	engine, err := xorm.NewEngine("sqlmock", dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })

	calls := 0
	store := &xormStore{sql: newProviderForTable(t, &sqlmockTeamDB{engine: engine}, &calls)}
	return store, mock, &calls
}

func operationContext() context.Context {
	return context.WithValue(context.Background(), providerContextKey{}, "provider context")
}

func TestStoreUsesProviderTable_RemoveUsersMemberships(t *testing.T) {
	store, mock, calls := newSQLMockTeamStore(t)

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM "test_schema"."team_member"
WHERE user_id = ?`)).
		WithArgs(int64(42)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	require.NoError(t, store.RemoveUsersMemberships(operationContext(), 42))
	require.Equal(t, 1, *calls)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestStoreUsesProviderTable_GetIDsByUser(t *testing.T) {
	store, mock, calls := newSQLMockTeamStore(t)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT tm.team_id, team.uid
FROM "test_schema"."team_member" as tm
JOIN "test_schema"."team" as team ON team.id = tm.team_id
WHERE tm.user_id = ?
  AND tm.org_id = ?
ORDER BY tm.team_id asc`)).
		WithArgs(int64(7), int64(3)).
		WillReturnRows(sqlmock.NewRows([]string{"team_id", "uid"}).AddRow(int64(11), "teamuid"))

	ids, uids, err := store.GetIDsByUser(operationContext(), &team.GetTeamIDsByUserQuery{OrgID: 3, UserID: 7})
	require.NoError(t, err)
	require.Equal(t, []int64{11}, ids)
	require.Equal(t, []string{"teamuid"}, uids)
	require.Equal(t, 1, *calls)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestStoreUsesProviderTable_RemoveTeamMemberHook(t *testing.T) {
	store, mock, calls := newSQLMockTeamStore(t)

	// teamExists check
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT 1
FROM "test_schema"."team"
WHERE org_id = ?
  AND id = ?`)).
		WithArgs(int64(1), int64(2)).
		WillReturnRows(sqlmock.NewRows([]string{"1"}).AddRow(1))

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM "test_schema"."team_member"
WHERE org_id = ?
  AND team_id = ?
  AND user_id = ?`)).
		WithArgs(int64(1), int64(2), int64(3)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	dbHelper, err := store.sql(operationContext())
	require.NoError(t, err)
	err = dbHelper.DB.WithTransactionalDbSession(context.Background(), func(sess *db.Session) error {
		return RemoveTeamMemberHook(dbHelper, sess, &team.RemoveTeamMemberCommand{OrgID: 1, TeamID: 2, UserID: 3})
	})
	require.NoError(t, err)
	require.Equal(t, 1, *calls)
	require.NoError(t, mock.ExpectationsWereMet())
}

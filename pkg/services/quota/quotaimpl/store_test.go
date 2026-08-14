package quotaimpl

import (
	"context"
	"regexp"
	"sync"
	"testing"
	"text/template"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

var registerQuotaSQLMockXormDriverOnce sync.Once

type quotaSQLMockXormDriver struct{}

func (quotaSQLMockXormDriver) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{DbType: core.SQLITE}, nil
}

type sqlmockQuotaDB struct {
	dbtest.FakeDB
	engine *xorm.Engine
}

func (d *sqlmockQuotaDB) WithDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.withSession(callback)
}

func (d *sqlmockQuotaDB) WithTransactionalDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.withSession(callback)
}

func (d *sqlmockQuotaDB) withSession(callback sqlstore.DBTransactionFunc) error {
	sess := &sqlstore.DBSession{Session: d.engine.NewSession()}
	defer sess.Close()
	return callback(sess)
}

func (d *sqlmockQuotaDB) GetDBType() core.DbType {
	return core.SQLITE
}

func TestIntegrationQuotaDataAccess(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ss := db.InitTestDB(t)
	quotaStore := sqlStore{
		sql: legacysql.NewDatabaseProvider(ss),
	}

	t.Run("quota deleted", func(t *testing.T) {
		ctx := quota.FromContext(context.Background(), &quota.TargetToSrv{})
		err := quotaStore.DeleteByUser(ctx, 1)
		require.NoError(t, err)
	})
}

func TestSQLStoreUsesProviderTable(t *testing.T) {
	registerQuotaSQLMockXormDriverOnce.Do(func() {
		if core.QueryDriver("sqlmock") == nil {
			core.RegisterDriver("sqlmock", quotaSQLMockXormDriver{})
		}
	})

	dsn := "quota-store"
	mockDB, mock, err := sqlmock.NewWithDSN(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = mockDB.Close() })

	engine, err := xorm.NewEngine("sqlmock", dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })

	legacyDB := &sqlmockQuotaDB{engine: engine}
	type contextKey struct{}
	ctx := context.WithValue(context.Background(), contextKey{}, "provider context")
	calls := 0
	provider := func(gotCtx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		require.Equal(t, "provider context", gotCtx.Value(contextKey{}))
		calls++
		return &legacysql.LegacyDatabaseHelper{
			DB: legacyDB,
			Table: func(name string) string {
				require.Equal(t, "quota", name)
				return "test_schema." + name
			},
		}, nil
	}
	quotaStore := sqlStore{sql: provider, logger: log.New("quota_test")}
	targetToSrv := quota.NewTargetToSrv()
	targetToSrv.Set("test", "service")
	quotaCtx := quota.FromContext(ctx, targetToSrv)

	findQuotaSQL := regexp.QuoteMeta(`SELECT id
FROM "test_schema"."quota"
WHERE target = ?
  AND user_id = ?`)
	mock.ExpectQuery(findQuotaSQL).
		WithArgs("test", int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO "test_schema"."quota" (
  org_id,
  user_id,
  target,
  "limit",
  created,
  updated
)
VALUES (
  ?,
  ?,
  ?,
  ?,
  ?,
  ?
)`)).
		WithArgs(int64(0), int64(42), "test", int64(3), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	require.NoError(t, quotaStore.Update(quotaCtx, &quota.UpdateQuotaCmd{
		Target: "test",
		Limit:  3,
		UserID: 42,
	}))

	mock.ExpectQuery(findQuotaSQL).
		WithArgs("test", int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(1)))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE "test_schema"."quota"
SET "limit" = ?,
    updated = ?
WHERE id = ?`)).
		WithArgs(int64(4), sqlmock.AnyArg(), int64(1)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, quotaStore.Update(quotaCtx, &quota.UpdateQuotaCmd{
		Target: "test",
		Limit:  4,
		UserID: 42,
	}))

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT target, "limit"
FROM "test_schema"."quota"
WHERE user_id = ?
  AND org_id = ?`)).
		WithArgs(int64(42), int64(0)).
		WillReturnRows(sqlmock.NewRows([]string{"target", "limit"}).AddRow("test", int64(4)))
	limits, err := quotaStore.Get(quotaCtx, &quota.ScopeParameters{UserID: 42})
	require.NoError(t, err)
	tag, err := quota.NewTag("service", "test", quota.UserScope)
	require.NoError(t, err)
	limit, ok := limits.Get(tag)
	require.True(t, ok)
	require.EqualValues(t, 4, limit)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT target, "limit"
FROM "test_schema"."quota"
WHERE user_id = ?
  AND org_id = ?`)).
		WithArgs(int64(0), int64(8)).
		WillReturnRows(sqlmock.NewRows([]string{"target", "limit"}).AddRow("test", int64(5)))
	limits, err = quotaStore.Get(quotaCtx, &quota.ScopeParameters{OrgID: 8})
	require.NoError(t, err)
	tag, err = quota.NewTag("service", "test", quota.OrgScope)
	require.NoError(t, err)
	limit, ok = limits.Get(tag)
	require.True(t, ok)
	require.EqualValues(t, 5, limit)

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM "test_schema"."quota"
WHERE user_id = ?`)).
		WithArgs(int64(42)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, quotaStore.DeleteByUser(quotaCtx, 42))
	require.Equal(t, 5, calls)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestTemplates(t *testing.T) {
	dbHelper := &legacysql.LegacyDatabaseHelper{
		Table: func(name string) string {
			return "test_schema." + name
		},
	}
	quotaTable := dbHelper.Table("quota")
	queryTemplate := func() sqltemplate.SQLTemplate {
		return mocks.NewTestingSQLTemplate()
	}
	now := time.Date(2025, 7, 22, 15, 0, 0, 0, time.UTC)

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			deleteByUserTemplate: {
				{
					Name: "delete_by_user",
					Data: deleteByUserQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						UserID:      42,
					},
				},
			},
			findQuotaTemplate: {
				{
					Name: "global_quota",
					Data: findQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						Target:      "test",
					},
				},
				{
					Name: "user_quota",
					Data: findQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						Target:      "test",
						UserID:      42,
					},
				},
				{
					Name: "org_quota",
					Data: findQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						Target:      "test",
						OrgID:       8,
					},
				},
			},
			insertQuotaTemplate: {
				{
					Name: "insert_quota",
					Data: insertQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						Target:      "test",
						UserID:      42,
						Limit:       3,
						Created:     legacysql.NewDBTime(now),
						Updated:     legacysql.NewDBTime(now),
					},
				},
			},
			updateQuotaTemplate: {
				{
					Name: "update_quota",
					Data: updateQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						QuotaID:     3,
						Limit:       4,
						Updated:     legacysql.NewDBTime(now),
					},
				},
			},
			userScopeQuotaTemplate: {
				{
					Name: "user_scope",
					Data: userScopeQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						UserID:      42,
						OrgID:       0,
					},
				},
			},
			orgScopeQuotaTemplate: {
				{
					Name: "org_scope",
					Data: orgScopeQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						UserID:      0,
						OrgID:       8,
					},
				},
			},
		},
	})
}

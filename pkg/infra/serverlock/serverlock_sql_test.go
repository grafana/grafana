package serverlock

import (
	"context"
	"database/sql/driver"
	"regexp"
	"sync"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

var registerServerLockSQLMockXormDriverOnce sync.Once

type serverLockSQLMockXormDriver struct{}

func (serverLockSQLMockXormDriver) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{DbType: core.SQLITE}, nil
}

type serverLockSQLMockDB struct {
	dbtest.FakeDB
	engine *xorm.Engine
}

func (d *serverLockSQLMockDB) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	sess := &sqlstore.DBSession{Session: d.engine.NewSession()}
	defer sess.Close()
	return callback(sess)
}

func (d *serverLockSQLMockDB) WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	sess := &sqlstore.DBSession{Session: d.engine.NewSession()}
	defer sess.Close()
	return callback(sess)
}

func (d *serverLockSQLMockDB) GetDBType() core.DbType {
	return core.SQLITE
}

type int64Arg struct{}

func (int64Arg) Match(value driver.Value) bool {
	_, ok := value.(int64)
	return ok
}

func TestServerLockUsesProviderTable(t *testing.T) {
	registerServerLockSQLMockXormDriverOnce.Do(func() {
		if core.QueryDriver("sqlmock") == nil {
			core.RegisterDriver("sqlmock", serverLockSQLMockXormDriver{})
		}
	})

	dsn := "serverlock"
	mockDB, mock, err := sqlmock.NewWithDSN(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = mockDB.Close() })

	engine, err := xorm.NewEngine("sqlmock", dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })

	legacyDB := &serverLockSQLMockDB{engine: engine}
	providerCalls := 0
	type contextKey struct{}
	ctx := context.WithValue(context.Background(), contextKey{}, "request-context")
	svc := &ServerLockService{
		sql: func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
			require.Equal(t, "request-context", ctx.Value(contextKey{}))
			providerCalls++
			return &legacysql.LegacyDatabaseHelper{
				DB: legacyDB,
				Table: func(n string) string {
					return "test_schema." + n
				},
			}, nil
		},
		tracer: tracing.InitializeTracerForTest(),
		log:    log.New("test-logger"),
	}

	updateVersionSQL := regexp.QuoteMeta(`UPDATE "test_schema"."server_lock"
SET version = ?,
    last_execution = ?
WHERE operation_uid = ?
  AND version = ?;`)
	mock.ExpectExec(updateVersionSQL).
		WithArgs(int64(3), int64Arg{}, "update", int64(2)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	acquired, err := svc.acquireLock(ctx, &serverLock{OperationUID: "update", Version: 2})
	require.NoError(t, err)
	require.True(t, acquired)

	getLockSQL := regexp.QuoteMeta(`SELECT *
FROM "test_schema"."server_lock"
WHERE operation_uid = ?;`)
	mock.ExpectQuery(getLockSQL).
		WithArgs("create").
		WillReturnRows(sqlmock.NewRows([]string{"id", "operation_uid", "last_execution", "version"}))

	createLockSQL := regexp.QuoteMeta(`INSERT INTO "test_schema"."server_lock" (operation_uid, last_execution, version)
VALUES (?, ?, ?);`)
	mock.ExpectExec(createLockSQL).
		WithArgs("create", int64(0), int64(0)).
		WillReturnResult(sqlmock.NewResult(1, 1))

	_, err = svc.getOrCreate(ctx, "create")
	require.NoError(t, err)

	getLockForUpdateSQL := regexp.QuoteMeta(`SELECT *
FROM "test_schema"."server_lock"
WHERE operation_uid = ?
;`)
	mock.ExpectQuery(getLockForUpdateSQL).
		WithArgs("expired").
		WillReturnRows(sqlmock.NewRows([]string{"id", "operation_uid", "last_execution", "version"}).
			AddRow(int64(1), "expired", int64(1), int64(0)))

	updateLastExecutionSQL := regexp.QuoteMeta(`UPDATE "test_schema"."server_lock"
SET last_execution = ?
WHERE operation_uid = ?;`)
	mock.ExpectExec(updateLastExecutionSQL).
		WithArgs(int64Arg{}, "expired").
		WillReturnResult(sqlmock.NewResult(0, 1))

	require.NoError(t, svc.acquireForRelease(ctx, "expired", time.Hour))

	releaseLockSQL := regexp.QuoteMeta(`DELETE FROM "test_schema"."server_lock"
WHERE operation_uid = ?;`)
	mock.ExpectExec(releaseLockSQL).
		WithArgs("release").
		WillReturnResult(sqlmock.NewResult(0, 1))

	require.NoError(t, svc.releaseLock(ctx, "release"))
	require.Equal(t, 4, providerCalls)
	require.NoError(t, mock.ExpectationsWereMet())
}

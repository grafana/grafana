package dbimpl

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil"
)

// defined in the standard library in database/sql/ctxutil.go
const noIsolationLevelSupportErrStr = "sql: driver does not support non-" +
	"default isolation level"

var _ driver.Driver = driverWithoutIsolationLevel{}
var _ driver.Driver = driverWithIsolationLevel{}

const (
	driverWithoutIsolationLevelName = "test driver without isolation levels"
	driverWithIsolationLevelName    = "test driver with isolation levels"
)

var registerTestDriversOnce sync.Once

func registerTestSQLDrivers() {
	registerTestDriversOnce.Do(func() {
		sql.Register(driverWithoutIsolationLevelName, driverWithoutIsolationLevel{})
		sql.Register(driverWithIsolationLevelName, driverWithIsolationLevel{})
	})
}

type (
	// without isolation level

	driverWithoutIsolationLevel struct{}
	connWithoutIsolationLevel   struct{}

	// with isolation level

	driverWithIsolationLevel struct{}
	connWithIsolationLevel   struct {
		connWithoutIsolationLevel
	}

	// common

	testStmt    struct{}
	testTx      struct{}
	testResults struct{}
	testRows    struct{}
)

// driver.Driver

func (driverWithoutIsolationLevel) Open(name string) (driver.Conn, error) {
	return connWithoutIsolationLevel{}, nil
}

func (driverWithIsolationLevel) Open(name string) (driver.Conn, error) {
	return connWithIsolationLevel{}, nil
}

// driver.Conn

func (connWithoutIsolationLevel) Prepare(query string) (driver.Stmt, error) {
	return testStmt{}, nil
}
func (connWithoutIsolationLevel) Close() error {
	return nil
}
func (connWithoutIsolationLevel) Begin() (driver.Tx, error) {
	return testTx{}, nil
}

func (connWithIsolationLevel) BeginTx(context.Context, driver.TxOptions) (driver.Tx, error) {
	return testTx{}, nil
}

// driver.Stmt

func (testStmt) Close() error                                    { return nil }
func (testStmt) NumInput() int                                   { return 0 }
func (testStmt) Exec(args []driver.Value) (driver.Result, error) { return testResults{}, nil }
func (testStmt) Query(args []driver.Value) (driver.Rows, error)  { return testRows{}, nil }

// driver.Tx

func (testTx) Commit() error   { return nil }
func (testTx) Rollback() error { return nil }

// driver.Results

func (testResults) LastInsertId() (int64, error) { return 1, nil }
func (testResults) RowsAffected() (int64, error) { return 1, nil }

// driver.Rows

func (testRows) Columns() []string              { return nil }
func (testRows) Close() error                   { return nil }
func (testRows) Next(dest []driver.Value) error { return nil }

func TestReproIncident2144IndependentOfGrafanaDB(t *testing.T) {
	t.Parallel()
	registerTestSQLDrivers()
	txOpts := &sql.TxOptions{
		Isolation: sql.LevelSerializable,
	}

	t.Run("driver without isolation level should fail", func(t *testing.T) {
		t.Parallel()
		ctx := testutil.NewDefaultTestContext(t)

		db, err := sql.Open(driverWithoutIsolationLevelName, "")
		require.NoError(t, err)
		require.NotNil(t, db)

		_, err = db.BeginTx(ctx, txOpts)
		require.Error(t, err)
		require.Equal(t, noIsolationLevelSupportErrStr, err.Error())
	})

	t.Run("driver with isolation level should work", func(t *testing.T) {
		t.Parallel()
		ctx := testutil.NewDefaultTestContext(t)

		db, err := sql.Open(driverWithIsolationLevelName, "")
		require.NoError(t, err)
		require.NotNil(t, db)

		_, err = db.BeginTx(ctx, txOpts)
		require.NoError(t, err)
	})
}

func TestReproIncident2144UsingGrafanaDB(t *testing.T) {
	t.Parallel()
	txOpts := &sql.TxOptions{
		Isolation: sql.LevelSerializable,
	}

	t.Run("core Grafana db without instrumentation preserves driver ability to use isolation levels",
		func(t *testing.T) {
			t.Parallel()

			t.Run("base behaviour is preserved", func(t *testing.T) {
				t.Parallel()
				ctx := testutil.NewDefaultTestContext(t)
				cfgMap := cfgMap{}
				setupDBForGrafana(t, ctx, cfgMap)
				grafanaDB := newTestInfraDB(t, cfgMap)
				db := grafanaDB.GetEngine().DB().DB
				_, err := db.BeginTx(ctx, txOpts)
				require.NoError(t, err)
			})

			t.Run("Resource API does not fail and correctly uses Grafana DB as fallback",
				func(t *testing.T) {
					t.Parallel()
					ctx := testutil.NewDefaultTestContext(t)
					cfgMap := cfgMap{}
					cfg := newCfgFromIniMap(t, cfgMap)
					setupDBForGrafana(t, ctx, cfgMap)
					grafanaDB := newTestInfraDB(t, cfgMap)
					resourceDB, err := ProvideResourceDB(grafanaDB, cfg, testGrafanaTracer{})
					require.NotNil(t, resourceDB)
					require.NoError(t, err)
				})
		})

	t.Run("core Grafana db instrumentation removes driver ability to use isolation levels",
		func(t *testing.T) {
			t.Parallel()
			ctx := testutil.NewDefaultTestContext(t)
			cfgMap := cfgMap{
				"database": cfgSectionMap{
					grafanaDBInstrumentQueriesKey: "true",
				},
			}
			setupDBForGrafana(t, ctx, cfgMap)
			grafanaDB := newTestInfraDB(t, cfgMap)

			t.Run("base failure caused by instrumentation", func(t *testing.T) {
				t.Parallel()
				ctx := testutil.NewDefaultTestContext(t)
				db := grafanaDB.GetEngine().DB().DB
				_, err := db.BeginTx(ctx, txOpts)
				require.Error(t, err)
				require.Equal(t, noIsolationLevelSupportErrStr, err.Error())
			})

			t.Run("Resource API provides a reasonable error for this case", func(t *testing.T) {
				t.Parallel()
				cfg := newCfgFromIniMap(t, cfgMap)
				resourceDB, err := ProvideResourceDB(grafanaDB, cfg, testGrafanaTracer{})
				require.Nil(t, resourceDB)
				require.Error(t, err)
				require.ErrorIs(t, err, errGrafanaDBInstrumentedNotSupported)
			})
		})
}

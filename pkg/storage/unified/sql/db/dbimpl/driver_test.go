package dbimpl

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"sync"
)

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

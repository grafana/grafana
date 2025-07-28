//go:build !cgo

package sqlite

import (
	"database/sql"
	"errors"

	"modernc.org/sqlite"
)

const DriverName = "sqlite"

// The errors below are used in tests to simulate specific SQLite errors. It's a temporary solution
// until we rewrite the tests not to depend on the sqlite3 package internals directly.
// Note: Since modernc.org/sqlite driver does not expose error codes like sqlite3, we cannot use the same approach.
var (
	TestErrUniqueConstraintViolation = errors.New("unique constraint violation (simulated)")
	TestErrBusy                      = errors.New("database is busy (simulated)")
	TestErrLocked                    = errors.New("database is locked (simulated)")
)

func init() {
	// alias the driver name to match the CGo driver
	sql.Register("sqlite3", &Driver{})
}

//
// FIXME (@zserge)
//
// This non-CGo "implementation" is merely a stub to make Grafana compile without CGo.
// Any attempts to actually use this driver are likely to fail at runtime in the most brutal ways.
//

type Driver = sqlite.Driver

const DriverName = "sqlite"

func IsBusyOrLocked(err error) bool {
	return false // FIXME
}
func IsUniqueConstraintViolation(err error) bool {
	return false // FIXME
}
func ErrorMessage(err error) string {
	return "" // FIXME
}

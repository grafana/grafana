//go:build cgo

package sqlite

import (
	"errors"

	"github.com/mattn/go-sqlite3"
)

type Driver = sqlite3.SQLiteDriver

const DriverName = "sqlite3"

// The errors below are used in tests to simulate specific SQLite errors. It's a temporary solution
// until we rewrite the tests not to depend on the sqlite3 package internals directly.
var (
	TestErrUniqueConstraintViolation = sqlite3.Error{Code: sqlite3.ErrConstraint, ExtendedCode: sqlite3.ErrConstraintUnique}
	TestErrBusy                      = sqlite3.Error{Code: sqlite3.ErrBusy}
	TestErrLocked                    = sqlite3.Error{Code: sqlite3.ErrLocked}
)

func IsBusyOrLocked(err error) bool {
	var sqliteErr sqlite3.Error
	if errors.As(err, &sqliteErr) {
		return sqliteErr.Code == sqlite3.ErrLocked || sqliteErr.Code == sqlite3.ErrBusy
	}
	return false
}

func IsUniqueConstraintViolation(err error) bool {
	var sqliteErr sqlite3.Error
	if errors.As(err, &sqliteErr) {
		return sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique || sqliteErr.ExtendedCode == sqlite3.ErrConstraintPrimaryKey
	}
	return false
}

func ErrorMessage(err error) string {
	if err == nil {
		return ""
	}
	var sqliteErr sqlite3.Error
	if errors.As(err, &sqliteErr) {
		return sqliteErr.Error()
	}
	return err.Error()
}

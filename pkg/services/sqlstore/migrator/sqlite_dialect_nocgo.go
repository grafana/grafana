//go:build !cgo

package migrator

import (
	"errors"

	"modernc.org/sqlite"
	libsqlite "modernc.org/sqlite/lib"
)

const SQLite = "sqlite"

var SQLite3Driver = &sqlite.Driver{}

func IsSQLiteErrLocked(err error) bool {
	code := SQLiteErrCode(err)
	return code == libsqlite.SQLITE_LOCKED || code == libsqlite.SQLITE_BUSY
}

func SQLiteErrCode(err error) int {
	var driverErr *sqlite.Error
	if errors.As(err, &driverErr) {
		return driverErr.Code()
	}
	return 0
}

func (db *SQLite3) ErrorMessage(err error) string {
	var driverErr *sqlite.Error
	if errors.As(err, &driverErr) {
		return driverErr.Error()
	}
	return ""
}

func (db *SQLite3) IsUniqueConstraintViolation(err error) bool {
	code := SQLiteErrCode(err)
	return code == libsqlite.SQLITE_CONSTRAINT
}

func (db *SQLite3) isThisError(err error, errcode int) bool { return SQLiteErrCode(err) == errcode }

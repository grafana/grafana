//go:build cgo

package migrator

import (
	"errors"

	"github.com/mattn/go-sqlite3"
)

const SQLite = "sqlite3"

var SQLite3Driver = &sqlite3.SQLiteDriver{}

func IsSQLiteErrLocked(err error) bool {
	return errors.Is(err, sqlite3.ErrLocked) || errors.Is(err, sqlite3.ErrBusy)
}
func SQLiteErrCode(err error) int {
	var sqliteErr sqlite3.Error
	if !errors.As(err, &sqliteErr) {
		return 0
	}
	return int(sqliteErr.Code)
}

func (db *SQLite3) isThisError(err error, errcode int) bool {
	var driverErr sqlite3.Error
	if errors.As(err, &driverErr) {
		if int(driverErr.ExtendedCode) == errcode {
			return true
		}
	}

	return false
}

func (db *SQLite3) ErrorMessage(err error) string {
	var driverErr sqlite3.Error
	if errors.As(err, &driverErr) {
		return driverErr.Error()
	}
	return ""
}

func (db *SQLite3) IsUniqueConstraintViolation(err error) bool {
	return db.isThisError(err, int(sqlite3.ErrConstraintUnique)) || db.isThisError(err, int(sqlite3.ErrConstraintPrimaryKey))
}

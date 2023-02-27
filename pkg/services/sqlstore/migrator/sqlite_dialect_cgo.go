//go:build cgo

package migrator

import (
	"errors"

	"github.com/mattn/go-sqlite3"
)

func IsRetryError(err error) bool {
	var sqlError sqlite3.Error
	return errors.As(err, &sqlError) && (sqlError.Code == sqlite3.ErrLocked || sqlError.Code == sqlite3.ErrBusy)
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
	return db.isThisError(err, int(sqlite3.ErrConstraintUnique))
}

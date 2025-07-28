//go:build cgo

package sqlite

import (
	"errors"

	"github.com/mattn/go-sqlite3"
)

type Error = sqlite3.Error

var (
	ErrConstraintUnique     = sqlite3.ErrConstraintUnique
	ErrConstraintPrimaryKey = sqlite3.ErrConstraintPrimaryKey
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

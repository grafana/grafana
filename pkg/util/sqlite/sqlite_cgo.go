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
	return errors.Is(err, sqlite3.ErrLocked) || errors.Is(err, sqlite3.ErrBusy)
	//(sqlError.Code == sqlite.ErrLocked || sqlError.Code == sqlite.ErrBusy) {
}

func IsUniqueConstraintViolation(err error) bool {
	var sqliteErr sqlite3.Error
	if errors.As(err, &sqliteErr) {
		return sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique || sqliteErr.ExtendedCode == sqlite3.ErrConstraintPrimaryKey
	}
	return false
}

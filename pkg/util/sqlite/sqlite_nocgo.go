//go:build !cgo

package sqlite

import "modernc.org/sqlite"

type Error = sqlite.Error

func IsBusyOrLocked(err error) bool {
	return false // FIXME
}
func IsUniqueConstraintViolation(err error) bool {
	return false // FIXME
}

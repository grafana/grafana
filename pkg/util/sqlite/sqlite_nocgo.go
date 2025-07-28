//go:build !cgo

package sqlite

import "modernc.org/sqlite"

type Driver = sqlite.Driver

func IsBusyOrLocked(err error) bool {
	return false // FIXME
}
func IsUniqueConstraintViolation(err error) bool {
	return false // FIXME
}
func ErrorMessage(err error) string {
	return "" // FIXME
}

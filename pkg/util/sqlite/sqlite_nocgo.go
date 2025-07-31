//go:build !cgo

package sqlite

import "modernc.org/sqlite"

//
// FIXME (@zserge)
//
// This non-CGo "implementation" is merely a stub to make Grafana compile without CGo.
// Any attempts to actually use this driver are likely to fail at runtime in the most brutal ways.
//

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

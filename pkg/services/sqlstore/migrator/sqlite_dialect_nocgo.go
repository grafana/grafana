//go:build !cgo

package migrator

func IsRetryError(err error) bool { return false }

func (db *SQLite3) isThisError(err error, errcode int) bool    { return false }
func (db *SQLite3) ErrorMessage(err error) string              { return "" }
func (db *SQLite3) IsUniqueConstraintViolation(err error) bool { return false }

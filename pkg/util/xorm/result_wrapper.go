package xorm

import (
	"database/sql"
	"errors"
	"strings"
)

// YDBResultWrapper wraps sql.Result to handle RowsAffected errors for YDB
type YDBResultWrapper struct {
	sql.Result
}

// NewYDBResultWrapper creates a new YDB result wrapper
func NewYDBResultWrapper(result sql.Result) *YDBResultWrapper {
	return &YDBResultWrapper{Result: result}
}

// RowsAffected returns the number of rows affected, or 0 if not implemented
func (w *YDBResultWrapper) RowsAffected() (int64, error) {
	if w.Result == nil {
		return 0, nil
	}

	affected, err := w.Result.RowsAffected()
	if err != nil {
		// Check if the error indicates "not implemented"
		if isNotImplementedError(err) {
			return 0, nil // Return 0 instead of error for not implemented
		}
		return 0, err
	}
	return affected, nil
}

// LastInsertId delegates to the wrapped result
func (w *YDBResultWrapper) LastInsertId() (int64, error) {
	if w.Result == nil {
		return 0, errors.New("LastInsertId is not supported")
	}
	return w.Result.LastInsertId()
}

// isNotImplementedError checks if the error indicates "not implemented"
func isNotImplementedError(err error) bool {
	if err == nil {
		return false
	}

	errStr := strings.ToLower(err.Error())
	// Common patterns for "not implemented" errors
	notImplementedPatterns := []string{
		"not implemented",
		"not supported",
		"unimplemented",
		"unsupported",
		"rowsaffected not implemented",
		"rowsaffected is not supported",
	}

	for _, pattern := range notImplementedPatterns {
		if strings.Contains(errStr, pattern) {
			return true
		}
	}

	return false
}

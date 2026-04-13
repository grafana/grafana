package sqlstore

import (
	"errors"
	"strings"

	"github.com/go-sql-driver/mysql"
	"github.com/lib/pq"
)

// IsAuthError reports whether err is a database authentication failure.
// It checks for driver-native error types first, then falls back to string
// matching for wrapped errors. Returns false for nil.
func IsAuthError(err error) bool {
	if err == nil {
		return false
	}

	// Postgres: check pq.Error codes
	// 28P01 = invalid_password, 28000 = invalid_authorization_specification
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return pqErr.Code == "28P01" || pqErr.Code == "28000"
	}

	// MySQL: check MySQLError number 1045 = ER_ACCESS_DENIED_ERROR
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) {
		return mysqlErr.Number == 1045
	}

	// Fallback: string matching for wrapped/opaque errors
	msg := err.Error()
	return strings.Contains(msg, "password authentication failed") ||
		strings.Contains(msg, "Access denied for user")
}

package team

import (
	"errors"
	"strings"

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"

	"github.com/grafana/grafana/pkg/util/sqlite"
)

// MySQL transient transaction error numbers (1213 ER_LOCK_DEADLOCK,
// 1205 ER_LOCK_WAIT_TIMEOUT).
const (
	mysqlErrLockDeadlock    uint16 = 1213
	mysqlErrLockWaitTimeout uint16 = 1205
)

// PostgreSQL transient transaction SQLSTATE codes (40P01 deadlock_detected,
// 40001 serialization_failure).
const (
	postgresErrDeadlockDetected     = "40P01"
	postgresErrSerializationFailure = "40001"
)

// isRetryableTxnError reports whether err is a transient transactional
// conflict that the engine has rolled back.
func isRetryableTxnError(err error) bool {
	if err == nil {
		return false
	}
	if sqlite.IsBusyOrLocked(err) {
		return true
	}
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) {
		switch mysqlErr.Number {
		case mysqlErrLockDeadlock, mysqlErrLockWaitTimeout:
			return true
		}
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == postgresErrDeadlockDetected ||
			pgErr.Code == postgresErrSerializationFailure
	}
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return string(pqErr.Code) == postgresErrDeadlockDetected ||
			string(pqErr.Code) == postgresErrSerializationFailure
	}
	// String-match fallback: unified-storage's AsErrorResult stringifies
	// the error into a proto Message field, so errors.As can't reach the
	// driver type — match what each driver's Error() actually emits.
	// Coverage is enforced by TestIsRetryableTxnError_StringFallback.
	msg := err.Error()
	return strings.Contains(msg, "Error 1213") || // MySQL ER_LOCK_DEADLOCK
		strings.Contains(msg, "Error 1205") || // MySQL ER_LOCK_WAIT_TIMEOUT
		strings.Contains(msg, "SQLSTATE 40P01") || // pgx v5 deadlock_detected
		strings.Contains(msg, "SQLSTATE 40001") || // pgx v5 serialization_failure
		strings.Contains(msg, "deadlock detected") || // lib/pq deadlock_detected
		strings.Contains(msg, "could not serialize") // lib/pq serialization_failure
}

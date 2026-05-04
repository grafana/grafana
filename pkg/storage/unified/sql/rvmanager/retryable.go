package rvmanager

import (
	"errors"

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"

	"github.com/grafana/grafana/pkg/util/sqlite"
)

// MySQL error numbers for transactional conflicts that the engine has already
// rolled back, so the whole WithTx body is safe to retry from the start.
//   1213: ER_LOCK_DEADLOCK
//   1205: ER_LOCK_WAIT_TIMEOUT
// https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
const (
	mysqlErrLockDeadlock    uint16 = 1213
	mysqlErrLockWaitTimeout uint16 = 1205
)

// PostgreSQL SQLSTATE codes for transient, retryable transaction failures.
//   40P01: deadlock_detected
//   40001: serialization_failure
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const (
	postgresErrDeadlockDetected     = "40P01"
	postgresErrSerializationFailure = "40001"
)

// isRetryableTxnError reports whether err represents a transient transactional
// conflict where the engine has already rolled the transaction back. The
// batched WithTx in execBatch is a closed loop (writes, RV lock, RV stamp), so
// rolling back and re-running it from the start is safe for any of these.
//
// SQLite: busy/locked (delegated to sqlite.IsBusyOrLocked).
// MySQL: 1213 deadlock, 1205 lock-wait timeout (InnoDB releases locks on rollback).
// PostgreSQL: 40P01 deadlock_detected, 40001 serialization_failure.
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
	return false
}

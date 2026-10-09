package database

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/grafana/dskit/backoff"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"

	"github.com/grafana/grafana/pkg/util/sqlite"
)

var transientTransactionBackoff = backoff.Config{
	MinBackoff: 25 * time.Millisecond,
	MaxBackoff: 100 * time.Millisecond,
	// dskit/backoff counts retries after the initial attempt, so this is four attempts.
	MaxRetries: 3,
}

func RetryOnTransientTransactionError(ctx context.Context, operation func() error) error {
	boff := backoff.New(ctx, transientTransactionBackoff)
	for {
		err := operation()
		if err == nil || !isTransientTransactionError(err) || !boff.Ongoing() {
			if ctxErr := ctx.Err(); ctxErr != nil && isTransientTransactionError(err) {
				return ctxErr
			}
			return err
		}
		boff.Wait()
	}
}

func isTransientTransactionError(err error) bool {
	if err == nil {
		return false
	}
	if sqlite.IsBusyOrLocked(err) {
		return true
	}
	if mysqlErr, ok := errors.AsType[*mysql.MySQLError](err); ok {
		return mysqlErr.Number == 1213 || mysqlErr.Number == 1205
	}
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok {
		return pgErr.Code == "40P01" || pgErr.Code == "40001"
	}
	if pqErr, ok := errors.AsType[*pq.Error](err); ok {
		return string(pqErr.Code) == "40P01" || string(pqErr.Code) == "40001"
	}

	msg := err.Error()
	return strings.Contains(msg, "Error 1213") ||
		strings.Contains(msg, "Error 1205") ||
		strings.Contains(msg, "SQLSTATE 40P01") ||
		strings.Contains(msg, "SQLSTATE 40001") ||
		strings.Contains(msg, "deadlock detected") ||
		strings.Contains(msg, "could not serialize")
}

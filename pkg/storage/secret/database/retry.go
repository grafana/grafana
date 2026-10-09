package database

import (
	"context"
	"errors"
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
	MaxRetries: 4,
}

func RetryOnTransientTransactionError(ctx context.Context, operation func() error) error {
	boff := backoff.New(ctx, transientTransactionBackoff)
	var err error
	for boff.Ongoing() {
		err = operation()
		if err == nil || !isTransientTransactionError(err) {
			return err
		}
		boff.Wait()
	}
	if ctxErr := ctx.Err(); ctxErr != nil {
		return ctxErr
	}
	return err
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

	return false
}

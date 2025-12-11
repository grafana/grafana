package dbimpl

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

const (
	// Connection retry settings for transient errors (e.g., Cloud SQL proxy pod churn)
	defaultConnAttemptTimeout = 3 * time.Second
	defaultConnMaxRetries     = 3
	defaultConnRetryBackoff   = 1 * time.Second
)

// NewDB converts a *sql.DB to a db.DB.
func NewDB(d *sql.DB, driverName string) db.DB {
	ret := sqlDB{
		DB:         d,
		driverName: driverName,
		log:        log.New("resource-db"),
	}
	ret.WithTxFunc = db.NewWithTxFunc(ret.BeginTx)

	return ret
}

type sqlDB struct {
	*sql.DB
	db.WithTxFunc
	driverName string
	log        log.Logger
}

func (d sqlDB) DriverName() string {
	return d.driverName
}

func (d sqlDB) QueryContext(ctx context.Context, query string, args ...any) (db.Rows, error) {
	return d.DB.QueryContext(ctx, query, args...)
}

func (d sqlDB) QueryRowContext(ctx context.Context, query string, args ...any) db.Row {
	return d.DB.QueryRowContext(ctx, query, args...)
}

func (d sqlDB) BeginTx(ctx context.Context, opts *sql.TxOptions) (db.Tx, error) {
	var tx *sql.Tx
	var err error
	var conn *sql.Conn

	// try to acquire a connection with retries on transient errors
	for attempt := 1; attempt <= defaultConnMaxRetries; attempt++ {
		connCtx, cancel := context.WithTimeout(ctx, defaultConnAttemptTimeout)
		conn, err = d.DB.Conn(connCtx)
		cancel()

		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		if !isTransientConnError(err) {
			return nil, err
		}

		d.log.Warn("Transient database connection error, retrying", "attempt", attempt, "max_retries", defaultConnMaxRetries, "error", err)

		if attempt < defaultConnMaxRetries {
			time.Sleep(defaultConnRetryBackoff)
		}
	}

	// once we have a connection, begin the transaction
	if err == nil {
		tx, err = conn.BeginTx(ctx, opts)
		if err == nil {
			return sqlTx{tx}, nil
		}
	}

	return nil, err
}

type sqlTx struct {
	*sql.Tx
}

// NewTx wraps an existing *sql.Tx with sqlTx
func NewTx(tx *sql.Tx) db.Tx {
	return sqlTx{tx}
}

func (tx sqlTx) QueryContext(ctx context.Context, query string, args ...any) (db.Rows, error) {
	// // codeql-suppress go/sql-query-built-from-user-controlled-sources "The query comes from a safe template source
	// and the parameters are passed as arguments."
	return tx.Tx.QueryContext(ctx, query, args...)
}

func (tx sqlTx) QueryRowContext(ctx context.Context, query string, args ...any) db.Row {
	// // codeql-suppress go/sql-query-built-from-user-controlled-sources "The query comes from a safe template source
	// and the parameters are passed as arguments."
	return tx.Tx.QueryRowContext(ctx, query, args...)
}

// isTransientConnError checks if an error is a transient connection error that should be retried.
// This includes TCP timeouts, connection refused, and other network-related errors that can occur
// during Cloud SQL proxy pod churn or similar infrastructure events.
func isTransientConnError(err error) bool {
	if err == nil {
		return false
	}

	errStr := err.Error()

	// TCP/network errors
	if strings.Contains(errStr, "i/o timeout") ||
		strings.Contains(errStr, "connection refused") ||
		strings.Contains(errStr, "connection reset") ||
		strings.Contains(errStr, "broken pipe") ||
		strings.Contains(errStr, "no such host") ||
		strings.Contains(errStr, "network is unreachable") {
		return true
	}

	// Context deadline exceeded from our attempt timeout
	if strings.Contains(errStr, "context deadline exceeded") {
		return true
	}

	// MySQL specific errors
	if strings.Contains(errStr, "bad connection") ||
		strings.Contains(errStr, "invalid connection") {
		return true
	}

	return false
}

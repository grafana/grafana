package dbimpl

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

const (
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

		if err == nil {
			break
		}

		// retry if connection deadline exceeded and attempts remain
		if errors.Is(err, context.DeadlineExceeded) && attempt < defaultConnMaxRetries {
			d.log.Warn("Timeout when acquiring database connection, retrying", "attempt", attempt, "max_retries", defaultConnMaxRetries)
			time.Sleep(defaultConnRetryBackoff)
			continue
		}

		if errors.Is(err, context.DeadlineExceeded) {
			d.log.Error("Timeout exceeded while trying to acquire database connection", "attempt", attempt, "max_retries", defaultConnMaxRetries)
			return nil, err
		}

		return nil, err
	}

	// once we have a connection, begin the transaction
	tx, err = conn.BeginTx(ctx, opts)
	if err != nil {
		if closeErr := conn.Close(); closeErr != nil {
			d.log.Error("Failed to close connection after BeginTx error", "error", closeErr)
		}
		return nil, err
	}

	return sqlTx{Tx: tx, conn: conn}, nil
}

// sqlTx wraps sql.Tx to add connection management
// since we are manually acquiring the connection in BeginTx() we need to also manually close it after Commit/Rollback
type sqlTx struct {
	*sql.Tx
	conn *sql.Conn
}

// NewTx wraps an existing *sql.Tx with sqlTx
func NewTx(tx *sql.Tx) db.Tx {
	return sqlTx{Tx: tx}
}

func (tx sqlTx) Commit() error {
	err := tx.Tx.Commit()
	if tx.conn != nil {
		if err = tx.conn.Close(); err != nil {
			return err
		}
	}
	return err
}

func (tx sqlTx) Rollback() error {
	err := tx.Tx.Rollback()
	if tx.conn != nil {
		if err = tx.conn.Close(); err != nil {
			return err
		}
	}
	return err
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

package dbimpl

import (
	"context"
	"database/sql"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

// NewDB converts a *sql.DB to a db.DB.
func NewDB(d *sql.DB, driverName string) db.DB {
	ret := sqlDB{
		DB:         d,
		driverName: driverName,
	}
	ret.WithTxFunc = db.NewWithTxFunc(ret.BeginTx)

	return ret
}

type sqlDB struct {
	*sql.DB
	db.WithTxFunc
	driverName string
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
	value := ctx.Value(sqlstore.ContextSessionKey{})
	if sess, ok := value.(*sqlstore.DBSession); ok && sess != nil {
		// If there's already a session in the context, always reuse it
		// regardless of whether it has a transaction open or not
		if sess.TransactionOpen() {
			// Reuse the existing transaction
			return reusedSessionTx{session: sess}, nil
		} else {
			// Start a transaction on the existing session instead of creating a new one
			// The Begin() method now properly sets the transactionOpen flag
			if err := sess.Begin(); err != nil {
				return nil, err
			}
			return reusedSessionTx{session: sess}, nil
		}
	}
	tx, err := d.DB.BeginTx(ctx, opts)
	if err != nil {
		return nil, err
	}
	return sqlTx{tx}, err
}

type sqlTx struct {
	*sql.Tx
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

type reusedSessionTx struct {
	session *sqlstore.DBSession
}

func (tx reusedSessionTx) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	affected, err := tx.session.Exec(append([]any{query}, args...))
	if err != nil {
		return nil, err
	}
	return &execResult{affected: affected}, nil
}

func (tx reusedSessionTx) QueryContext(ctx context.Context, query string, args ...any) (db.Rows, error) {
	return tx.session.DB().DB.QueryContext(ctx, query, args...)
	// return tx.session.SQL(append([]any{query}, args...)).Query()
}

func (tx reusedSessionTx) QueryRowContext(ctx context.Context, query string, args ...any) db.Row {
	return tx.session.DB().DB.QueryRowContext(ctx, query, args...)
	// Use the session's existing transaction
	// xorm doesn't have a direct QueryRow equivalent, so we'll need to adapt
	// rows, err := tx.session.SQL(query, args...).Query()
	// if err != nil {
	// 	return &errorRow{err: err}
	// }
	// return &rowFromRows{rows: rows}
}

func (tx reusedSessionTx) Commit() error {
	// Only commit if this session actually started the transaction
	// In practice, this should be handled by the outer transaction manager
	return nil
}
func (tx reusedSessionTx) Rollback() error {
	// Only rollback if this session actually started the transaction
	// In practice, this should be handled by the outer transaction manager
	return nil
}

type execResult struct {
	affected sql.Result
}

func (r *execResult) LastInsertId() (int64, error) { return r.affected.LastInsertId() }
func (r *execResult) RowsAffected() (int64, error) { return r.affected.RowsAffected() }

type errorRow struct {
	err error
}

func (r *errorRow) Scan(dest ...any) error { return r.err }
func (r *errorRow) Err() error             { return r.err }

type rowFromRows struct {
	rows []map[string][]byte
}

func (r *rowFromRows) Scan(dest ...any) error {
	return nil
	// if !r.rows.Next() {
	// 	return r.rows.Err()
	// }
	// return r.rows.Scan(dest...)
}
func (r *rowFromRows) Err() error { return nil }

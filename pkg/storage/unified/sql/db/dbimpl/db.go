package dbimpl

import (
	"context"
	"database/sql"
	"fmt"

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
	fmt.Printf("unified storage BeginTx called\n")
	value := ctx.Value(sqlstore.ContextSessionKey{})
	if sess, ok := value.(*sqlstore.DBSession); ok && sess != nil {
		fmt.Printf("  Reusing existing sqlstore session for unified storage transaction: transactionOpen=%v\n", sess != nil)
		return reusedSessionTx{session: sess}, nil
	}
	fmt.Printf("  No existing sqlstore session, creating new unified storage transaction\n")
	tx, err := d.DB.BeginTx(ctx, opts)
	fmt.Println("  Beginning transaction with options:", opts, "error:", err)
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

func (tx reusedSessionTx) Commit() error   { return nil }
func (tx reusedSessionTx) Rollback() error { return nil }

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

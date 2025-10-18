package db

import (
	"context"
	"database/sql"
	"fmt"
)

//go:generate mockery --with-expecter --name DB
//go:generate mockery --with-expecter --name Tx
//go:generate mockery --with-expecter --name Row
//go:generate mockery --with-expecter --name Rows
//go:generate mockery --with-expecter --exported --name result

// DBProvider provides access to a SQL Database.
type DBProvider interface {
	// Init initializes the SQL Database, running migrations if needed. It is
	// idempotent and thread-safe.
	Init(context.Context) (DB, error)
}

// DB is a thin abstraction on *sql.DB to allow mocking to provide better unit
// testing. We purposefully hide database operation methods that would use
// context.Background().
type DB interface {
	ContextExecer
	BeginTx(context.Context, *sql.TxOptions) (Tx, error)
	WithTx(context.Context, *sql.TxOptions, TxFunc) error
	PingContext(context.Context) error
	Stats() sql.DBStats
	DriverName() string
}

// TxFunc is a function that executes with access to a transaction. The context
// it receives is the same context used to create the transaction, and is
// provided so that a general prupose TxFunc is able to retrieve information
// from that context, and derive other contexts that may be used to run database
// operation methods accepting a context. A derived context can be used to
// request a specific database operation to take no more than a specific
// fraction of the remaining timeout of the transaction context, or to enrich
// the downstream observability layer with relevant information regarding the
// specific operation being carried out.
type TxFunc = func(context.Context, Tx) error

// Tx is a thin abstraction on *sql.Tx to allow mocking to provide better unit
// testing. We allow database operation methods that do not take a
// context.Context here since a Tx can only be obtained with DB.BeginTx, which
// already takes a context.Context.
type Tx interface {
	ContextExecer
	Commit() error
	Rollback() error
}

// ContextExecer is a set of database operation methods that take
// context.Context.
type ContextExecer interface {
	ExecContext(ctx context.Context, query string, args ...any) (Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) Row
}

// Row is the set of methods from *sql.Row that we use.
type Row interface {
	Err() error
	Scan(dest ...any) error
}

// Rows is the set of methods from *sql.Rows that we use.
type Rows interface {
	Close() error
	Err() error
	Next() bool
	NextResultSet() bool
	Scan(dest ...any) error
}

// Result is the standard sql.Result interface, for convenience.
type Result = sql.Result

// result is needed for mockery, since it doesn't support type aliases.
//
//nolint:unused
type result interface {
	Result
}

// WithTxFunc is an adapter to be able to provide the DB.WithTx method as an
// embedded function.
type WithTxFunc func(context.Context, *sql.TxOptions, TxFunc) error

// WithTx implements the DB.WithTx method.
func (x WithTxFunc) WithTx(ctx context.Context, opts *sql.TxOptions, f TxFunc) error {
	return x(ctx, opts, f)
}

// BeginTxFunc is the signature of the DB.BeginTx method.
type BeginTxFunc = func(context.Context, *sql.TxOptions) (Tx, error)

// NewWithTxFunc provides implementations of DB an easy way to provide the
// DB.WithTx method.
// Example usage:
//
//	type myDB struct {
//		db.WithTxFunc // embedded so that `WithTx` is already provided
//		// other members...
//	}
//
//	func NewMyDB(/* options */) (db.DB, error) {
//		ret := new(myDB)
//		ret.WithTxFunc = db.NewWithTxFunc(ret.BeginTx)
//		// other initialization code ...
//		return ret, nil
//	}
func NewWithTxFunc(x BeginTxFunc) WithTxFunc {
	return WithTxFunc(
		func(ctx context.Context, opts *sql.TxOptions, f TxFunc) error {
			t, err := x(ctx, opts)
			if err != nil {
				return fmt.Errorf(oneErrFmt, beginStr, err)
			}

			if err := f(ctx, t); err != nil {
				if rollbackErr := t.Rollback(); rollbackErr != nil {
					return fmt.Errorf(twoErrFmt, txOpStr, err, rollbackStr,
						rollbackErr)
				}
				return fmt.Errorf(oneErrFmt, txOpStr, err)
			}

			if err = t.Commit(); err != nil {
				return fmt.Errorf(oneErrFmt, commitStr, err)
			}

			return nil
		},
	)
}

// Constants that allow testing that the correct scenario was hit.
const (
	oneErrFmt = "%s: %w"
	twoErrFmt = oneErrFmt + "; " + oneErrFmt

	// keep the following ones in sync with the matching ones in
	// `service_test.go`.

	txOpStr     = "transactional operation"
	beginStr    = "begin"
	commitStr   = "commit"
	rollbackStr = "rollback"
)

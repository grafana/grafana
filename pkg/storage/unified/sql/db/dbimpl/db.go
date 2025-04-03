package dbimpl

import (
	"context"
	"database/sql"

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
	stm, err := d.DB.PrepareContext(ctx, query)
	if err != nil {
		return nil, err
	}

	var closeErr error
	defer func() {
		if err := stm.Close(); err != nil {
			closeErr = err
		}
	}()

	rows, err := stm.QueryContext(ctx, args...)
	if err != nil {
		return nil, err
	}

	if closeErr != nil {
		return nil, closeErr
	}

	return rows, nil
}

func (d sqlDB) QueryRowContext(ctx context.Context, query string, args ...any) db.Row {
	stm, err := d.DB.PrepareContext(ctx, query)
	if err != nil {
		return &sqlDBRow{err: err}
	}

	var closeErr error
	defer func() {
		if err := stm.Close(); err != nil {
			closeErr = err
		}
	}()

	row := stm.QueryRowContext(ctx, args...)

	if closeErr != nil {
		return &sqlDBRow{err: closeErr}
	}

	return row
}

type sqlDBRow struct {
	err error
}

func (r sqlDBRow) Err() error {
	return r.err
}

func (r sqlDBRow) Scan(dest ...any) error {
	return r.err
}

func (d sqlDB) BeginTx(ctx context.Context, opts *sql.TxOptions) (db.Tx, error) {
	tx, err := d.DB.BeginTx(ctx, opts)
	if err != nil {
		return nil, err
	}
	return sqlTx{tx}, err
}

type sqlTx struct {
	*sql.Tx
}

func (d sqlTx) QueryContext(ctx context.Context, query string, args ...any) (db.Rows, error) {
	return d.Tx.QueryContext(ctx, query, args...)
}

func (d sqlTx) QueryRowContext(ctx context.Context, query string, args ...any) db.Row {
	return d.Tx.QueryRowContext(ctx, query, args...)
}

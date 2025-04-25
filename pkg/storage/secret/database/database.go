package database

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jmoiron/sqlx"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

// contextSessionTxKey is the key used to store the transaction in the context.
type contextSessionTxKey struct{}

// Implements contracts.Database
type Database struct {
	dbType string
	sqlx   *sqlx.DB
}

func ProvideDatabase(db db.DB) *Database {
	return &Database{
		dbType: string(db.GetDBType()),
		sqlx:   sqlx.NewDb(db.GetEngine().DB().DB, db.GetDialect().DriverName()),
	}
}

func (db *Database) DriverName() string {
	return db.dbType
}

func (db *Database) Transaction(ctx context.Context, callback func(context.Context) error) error {
	txCtx := ctx

	// If another transaction is already open, we just use that one instead of nesting.
	sqlxTx, ok := txCtx.Value(contextSessionTxKey{}).(*sqlx.Tx)
	if sqlxTx != nil && ok {
		// We are already in a transaction, so we don't commit or rollback, let the outermost transaction do it.
		return callback(txCtx)
	}

	tx, err := db.sqlx.Beginx()
	if err != nil {
		return err
	}

	sqlxTx = tx

	// Save it in the context so the transaction can be reused in case it is nested.
	txCtx = context.WithValue(ctx, contextSessionTxKey{}, sqlxTx)

	if err := callback(txCtx); err != nil {
		if rbErr := sqlxTx.Rollback(); rbErr != nil {
			return errors.Join(err, rbErr)
		}

		return err
	}

	return sqlxTx.Commit()
}

func (db *Database) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	// If another transaction is already open, we just use that one instead of nesting.
	if tx, ok := ctx.Value(contextSessionTxKey{}).(*sqlx.Tx); tx != nil && ok {
		return tx.ExecContext(ctx, db.sqlx.Rebind(query), args...)
	}

	return db.sqlx.ExecContext(ctx, db.sqlx.Rebind(query), args...)
}

func (db *Database) QueryContext(ctx context.Context, query string, args ...any) (contracts.Rows, error) {
	// If another transaction is already open, we just use that one instead of nesting.
	if tx, ok := ctx.Value(contextSessionTxKey{}).(*sqlx.Tx); tx != nil && ok {
		return tx.QueryContext(ctx, db.sqlx.Rebind(query), args...)
	}

	return db.sqlx.QueryContext(ctx, db.sqlx.Rebind(query), args...)
}

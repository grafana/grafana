package database

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jmoiron/sqlx"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

// contextSessionTxKey is the key used to store the transaction in the context.
type contextSessionTxKey struct{}

type sqlSessionProvider interface {
	GetSqlxSession() *session.SessionDB
}

// Implements contracts.Database
type Database struct {
	dbType string
	sqlx   *sqlx.DB
	tracer trace.Tracer
}

func ProvideDatabase(provider sqlSessionProvider, tracer trace.Tracer) *Database {
	sqlSession := provider.GetSqlxSession()

	return &Database{
		dbType: sqlSession.DriverName(),
		sqlx:   sqlx.NewDb(sqlSession.SqlDB(), sqlSession.DriverName()),
		tracer: tracer,
	}
}

func (db *Database) DriverName() string {
	return db.dbType
}

func (db *Database) Transaction(ctx context.Context, callback func(context.Context) error) (err error) {
	// If another transaction is already open, we just use that one instead of nesting.
	sqlxTx, ok := ctx.Value(contextSessionTxKey{}).(*sqlx.Tx)
	if sqlxTx != nil && ok {
		// We are already in a transaction, so we don't commit or rollback, let the outermost transaction do it.
		return callback(ctx)
	}

	spanCtx, span := db.tracer.Start(ctx, "Database.Transaction")
	defer span.End()

	defer func() {
		if err != nil {
			span.SetStatus(codes.Error, "Transaction failed")
			span.RecordError(err)
		}
	}()

	sqlxTx, err = db.sqlx.BeginTxx(spanCtx, nil)
	if err != nil {
		return err
	}

	// Save it in the context so the transaction can be reused in case it is nested.
	txCtx := context.WithValue(spanCtx, contextSessionTxKey{}, sqlxTx)

	if err := callback(txCtx); err != nil {
		if rbErr := sqlxTx.Rollback(); rbErr != nil {
			return errors.Join(err, rbErr)
		}

		return err
	}

	return sqlxTx.Commit()
}

func (db *Database) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	spanCtx, span := db.tracer.Start(ctx, "Database.ExecContext")
	defer span.End()

	// If another transaction is already open, we just use that one instead of nesting.
	if tx, ok := ctx.Value(contextSessionTxKey{}).(*sqlx.Tx); tx != nil && ok {
		return tx.ExecContext(spanCtx, db.sqlx.Rebind(query), args...)
	}

	return db.sqlx.ExecContext(spanCtx, db.sqlx.Rebind(query), args...)
}

func (db *Database) QueryContext(ctx context.Context, query string, args ...any) (contracts.Rows, error) {
	spanCtx, span := db.tracer.Start(ctx, "Database.QueryContext")
	defer span.End()

	// If another transaction is already open, we just use that one instead of nesting.
	if tx, ok := ctx.Value(contextSessionTxKey{}).(*sqlx.Tx); tx != nil && ok {
		return tx.QueryContext(spanCtx, db.sqlx.Rebind(query), args...)
	}

	return db.sqlx.QueryContext(spanCtx, db.sqlx.Rebind(query), args...)
}

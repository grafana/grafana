package database

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jmoiron/sqlx"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// contextSessionTxKey is the key used to store the transaction in the context.
type contextSessionTxKey struct{}

// Implements contracts.Database
type Database struct {
	dbType string
	sqlx   *sqlx.DB
	tracer trace.Tracer

	// Keep the xorm.Engine instance and its references alive until the apiserver is shut down.
	// This is only needed because the xorm.Engine calls a runtime.SetFinalizer, in a RAII-like pattern to close the DB,
	// when the engine is garbage collected. Normally, this will only ever happen when the server shuts down.
	// Ref: pkg/util/xorm/xorm.go:118 (it seems to be a relic from the xorm codebase that was copied over).
	// In single tenant Grafana, there are many other services and references to the xorm.Engine, so it never gets GC'd.
	// At some point in the future if we migrate everything away from it, we need to revisit how we set up the DB opening.
	// However, with the multi-tenant apiserver, we are no longer using the xorm.Engine directly for our DB queries.
	// We only use it to bootstrap the database and run migrations.
	// Instead, we use a pointer to *sql.DB directly, and that is created from *xorm.Engine -> *core.DB (also xorm) -> *sql.DB.
	// The GC notices that the xorm.Engine is no longer referenced, and calls the finalizer to close the DB, because we
	// only reference the pointer to *sql.DB. Here we tie the lifetime of the xorm.Engine to the Database we use for queries.
	engine *xorm.Engine
}

func ProvideDatabase(db db.DB, tracer trace.Tracer) *Database {
	engine := db.GetEngine()

	return &Database{
		dbType: string(db.GetDBType()),
		sqlx:   sqlx.NewDb(engine.DB().DB, db.GetDialect().DriverName()),
		engine: engine,
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

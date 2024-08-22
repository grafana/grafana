package db

import (
	"context"
	"database/sql"

	"go.opentelemetry.io/otel/trace"
)

const tracePrefix = "stdlib.database.sql.db."

type traceDB struct {
	DB
	tracer trace.Tracer
}

func (x traceDB) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"ExecContext")
	defer span.End()
	return x.DB.ExecContext(ctx, query, args...)
}

func (x traceDB) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"QueryContext")
	defer span.End()
	return x.DB.QueryContext(ctx, query, args...)
}

func (x traceDB) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"QueryRowContext")
	defer span.End()
	return x.DB.QueryRowContext(ctx, query, args...)
}

func (x traceDB) BeginTx(ctx context.Context, opts *sql.TxOptions) (Tx, error) {
	panic("TODO")
}

type traceTx struct {
	Tx
	tracer trace.Tracer
}

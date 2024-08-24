package db

import (
	"context"
	"database/sql"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

const (
	dbVersionDefaultSQL = `SELECT VERSION()`
	dbVersionSQLiteSQL  = `SELECT SQLITE_VERSION()`

	dbTracePrefix          = "sql.db."
	dbTraceExecContext     = dbTracePrefix + "exec_context"
	dbTraceQueryContext    = dbTracePrefix + "query_context"
	dbTraceQueryRowContext = dbTracePrefix + "query_row_context"
	dbTraceBeginTx         = dbTracePrefix + "begin_tx"
	dbTraceWithTx          = dbTracePrefix + "with_tx"
	dbTracePingContext     = dbTracePrefix + "ping_context"

	txTracePrefix          = "sql.db.tx."
	txTraceExecContext     = txTracePrefix + "exec_context"
	txTraceQueryContext    = txTracePrefix + "query_context"
	txTraceQueryRowContext = txTracePrefix + "query_row_context"
	txTraceCommit          = txTracePrefix + "commit"
	txTraceRollback        = txTracePrefix + "rollback"

	attrDriverName     = "driver_name"
	attrServerVersion  = "server_version"
	attrIsolationLevel = "isolation_level"
	attrReadOnly       = "read_only"
)

var (
	emptyAttrsList    []attribute.KeyValue
	spanOptKindClient = trace.WithSpanKind(trace.SpanKindClient)
	defaultTxOpts     = new(sql.TxOptions)
)

type ctxKey struct{}

// SetAttributes returns a context with one-time use tracing attributes that
// will be attached to the next database operation span. The prupose of this is
// to trace specific SQL queries and operations.
// Example:
//
//	// the following QueryContext operation will have an extra attribute
//	ctx = SetAttributes(attribute.String("query", "get user by id"))
//	res, err := myTracedTx.QueryContext(ctx, getUserByIDSQL, userID)
//
//	// the following ExecContext operation will have an extra attribute
//	ctx = SetAttributes(attribute.String("query", "disable user"))
//	err = myTracedTx.ExecContext(ctx, disableUserSQL, userID)
//
//	// the following Commit operation will NOT have any extra attribute
//	err = myTracedTx.Commit(ctx)
//
// NOTE: if you want several database operations to share the same attribute,
// consider using a span for them instead.
func SetAttributes(ctx context.Context, attrs ...attribute.KeyValue) context.Context {
	// we will use a pointer so that we can set that pointer to `emptyAttrsList`
	// after the first use. This will prevent the same attributes to be reused,
	// even if the same context is used later. Additionally, if a context that
	// was already used for this purpose is passed, we don't need to derive a
	// new context
	val, _ := ctx.Value(ctxKey{})
	if val == nil {
		ctx = context.WithValue(ctx, ctxKey{}, &attrs)
	} else {
		*val = attrs
	}

	return ctx
}

type dbTracer struct {
	db.DB
	tracer     trace.Tracer
	driverName string

	initOnce        sync.Once
	dbServerVersion string
}

func NewDBTracer(d DB, tracer trace.Tracer) DB {
	return &dbTracer{
		DB:              d,
		tracer:          tracer,
		driverName:      d.DriverName(),
		dbServerVersion: "unknown",
	}
}

func (x *dbTracer) init(ctx context.Context) {
	x.initOnce.Do(func() {
		row := x.DB.QueryRowContext(ctx, dbVersionDefaultSQL)
		if row.Err() != nil {
			row = x.DB.QueryRowContext(ctx, dbVersionSQLiteSQL)
			if row.Err() != nil {
				return
			}
		}

		var dbServerVersion string
		if err := row.Scan(&dbServerVersion); err == nil {
			x.dbServerVersion = dbServerVersion
		}
	})
}

func (x *dbTracer) startSpan(ctx context.Context, name string) (context.Context, trace.Span) {
	x.init(ctx)
	ctx, span := x.tracer.Start(ctx, name, spanOptKindClient)
	span.SetAttributes(
		attribute.String(attrDriverName, x.driverName),
		attribute.String(attrServerVersion, x.dbServerVersion),
	)

	return ctx, span
}

func (x *dbTracer) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	ctx, span := x.startSpan(ctx, dbTraceExecContext)
	defer span.End()
	res, err := x.DB.ExecContext(ctx, query, args...)
	setSpanOutcome(span, err)

	return res, err
}

func (x *dbTracer) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	ctx, span := x.startSpan(ctx, dbTraceQueryContext)
	defer span.End()
	rows, err := x.DB.QueryContext(ctx, query, args...)
	setSpanOutcome(span, err)

	return rows, err
}

func (x *dbTracer) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	ctx, span := x.startSpan(ctx, dbTraceQueryRowContext)
	defer span.End()
	row := x.DB.QueryRowContext(ctx, query, args...)
	setSpanOutcome(span, row.Err())

	return row
}

func (x *dbTracer) BeginTx(ctx context.Context, opts *sql.TxOptions) (Tx, error) {
	ctx, span := x.startSpan(ctx, dbTraceBeginTx)
	defer span.End()
	setSpanTxOpts(span, opts)
	tx, err := x.DB.BeginTx(ctx, opts)
	setSpanOutcome(span, err)

	return tx, err
}

func (x *dbTracer) WithTx(ctx context.Context, opts *sql.TxOptions, f TxFunc) error {
	ctx, span := x.startSpan(ctx, dbTraceWithTx)
	defer span.End()
	setSpanTxOpts(span, opts)
	tx, err := x.DB.WithTx(ctx, opts, f)
	setSpanOutcome(span, err)

	return tx, err
}

func (x *dbTracer) PingContext(context.Context) error {
	ctx, span := x.startSpan(ctx, dbTracePingContext)
	defer span.End()
	tx, err := x.DB.PingContext(ctx)
	setSpanOutcome(span, err)

	return err
}

type txTracer struct {
	Tx
	tracer          trace.Tracer
	driverName      string
	dbServerVersion string
}

func (x txTracer) startSpan(ctx context.Context, name string) (context.Context, trace.Span) {
	ctx, span := x.tracer.Start(ctx, name, spanOptKindClient)
	span.SetAttributes(
		attribute.String(attrDriverName, x.driverName),
		attribute.String(attrServerVersion, x.dbServerVersion),
	)

	return ctx, span
}

func (x txTracer) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	ctx, span := x.startSpan(ctx, txTraceExecContext)
	defer span.End()
	res, err := x.Tx.ExecContext(ctx, query, args...)
	setSpanOutcome(span, err)

	return res, err
}

func (x txTracer) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	ctx, span := x.startSpan(ctx, txTraceQueryContext)
	defer span.End()
	rows, err := x.Tx.QueryContext(ctx, query, args...)
	setSpanOutcome(span, err)

	return rows, err
}

func (x txTracer) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	ctx, span := x.startSpan(ctx, txTraceQueryRowContext)
	defer span.End()
	row := x.Tx.QueryRowContext(ctx, query, args...)
	setSpanOutcome(span, row.Err())

	return row
}

func (x txTracer) Commit() error {
	ctx, span := x.startSpan(ctx, txTraceCommit)
	defer span.End()
	tx, err := x.DB.Commit(ctx)
	setSpanOutcome(span, err)

	return err
}

func (x txTracer) Rollback() error {
	ctx, span := x.startSpan(ctx, txTraceRollback)
	defer span.End()
	tx, err := x.DB.Rollback(ctx)
	setSpanOutcome(span, err)

	return err
}

func setSpanTxOpts(span trace.Span, opts *sql.TxOptions) {
	if opts == nil {
		opts = defaultTxOpts
	}
	span.SetAttributes(
		attribute.String(attrIsolationLevel, opts.Isolation.String()),
		attribute.Bool(attrReadOnly, opts.ReadOnly),
	)
}

func setSpanOutcome(span trace.Span, err error) {
	if err == nil {
		span.SetStatus(codes.Ok, "")
	} else {
		span.RecordError(err)
		span.SetStatus(codes.Error, "")
	}
}

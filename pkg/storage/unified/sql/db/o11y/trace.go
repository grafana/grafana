package o11y

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
// NOTE: if you want several database operations to share the same set of
// attributes, consider using a span for them instead.
func SetAttributes(ctx context.Context, attrs ...attribute.KeyValue) context.Context {
	// we will use a pointer so that we can set that pointer to `emptyAttrsList`
	// after the first use. This will prevent the same attributes to be reused,
	// even if the same context is used later. Additionally, if a context that
	// was already used for this purpose is passed, we don't need to derive a
	// new context
	val, _ := ctx.Value(ctxKey{}).(*[]attribute.KeyValue)
	if val == nil {
		ctx = context.WithValue(ctx, ctxKey{}, &attrs)
	} else {
		*val = attrs
	}

	return ctx
}

func consumeAttributes(ctx context.Context) []attribute.KeyValue {
	val, _ := ctx.Value(ctxKey{}).(*[]attribute.KeyValue)
	if val == nil {
		return nil
	}
	ret := *val
	*val = nil
	return ret
}

type dbO11y struct {
	db.DB
	tracer     trace.Tracer
	driverName string

	initOnce        sync.Once
	dbServerVersion string
}

// NewInstrumentedDB ...
func NewInstrumentedDB(d db.DB, tracer trace.Tracer) db.DB {
	return &dbO11y{
		DB:              d,
		tracer:          tracer,
		driverName:      d.DriverName(),
		dbServerVersion: "unknown",
	}
}

func (x *dbO11y) init(ctx context.Context) {
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

func (x *dbO11y) startSpan(ctx context.Context, name string) (context.Context, trace.Span) {
	x.init(ctx)
	ctx, span := x.tracer.Start(ctx, name, spanOptKindClient)
	span.SetAttributes(consumeAttributes(ctx)...)
	span.SetAttributes(
		attribute.String(attrDriverName, x.driverName),
		attribute.String(attrServerVersion, x.dbServerVersion),
	)

	return ctx, span
}

func (x *dbO11y) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	ctx, span := x.startSpan(ctx, dbTraceExecContext)
	defer span.End()
	res, err := x.DB.ExecContext(ctx, query, args...)
	setSpanOutcome(span, err)
	return res, err
}

func (x *dbO11y) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	ctx, span := x.startSpan(ctx, dbTraceQueryContext)
	defer span.End()
	rows, err := x.DB.QueryContext(ctx, query, args...)
	setSpanOutcome(span, err)
	return rows, err
}

func (x *dbO11y) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	ctx, span := x.startSpan(ctx, dbTraceQueryRowContext)
	defer span.End()
	row := x.DB.QueryRowContext(ctx, query, args...)
	setSpanOutcome(span, row.Err())
	return row
}

func (x *dbO11y) BeginTx(ctx context.Context, opts *sql.TxOptions) (db.Tx, error) {
	ctx, span := x.startSpan(ctx, dbTraceBeginTx)
	defer span.End()
	setSpanTxOpts(span, opts)
	tx, err := x.DB.BeginTx(ctx, opts)
	setSpanOutcome(span, err)
	if err != nil {
		return nil, err
	}

	txx := txO11y{
		Tx:              tx,
		tracer:          x.tracer,
		driverName:      x.driverName,
		dbServerVersion: x.dbServerVersion,
	}

	// we don't hold a direct reference to the context of BeginTx. Instead, we
	// create a closure that captures its only intended usage. This closure is
	// used to create the span for Rollback and Commit, since those methods are
	// the only ones that do not take a context argument
	txx.finishTxSpan = func(name string) trace.Span {
		_, span := txx.startSpan(ctx, name)
		return span
	}

	return txx, nil
}

func (x *dbO11y) WithTx(ctx context.Context, opts *sql.TxOptions, f db.TxFunc) error {
	ctx, span := x.startSpan(ctx, dbTraceWithTx)
	defer span.End()
	setSpanTxOpts(span, opts)
	err := x.DB.WithTx(ctx, opts, f)
	setSpanOutcome(span, err)
	return err
}

func (x *dbO11y) PingContext(ctx context.Context) error {
	ctx, span := x.startSpan(ctx, dbTracePingContext)
	defer span.End()
	err := x.DB.PingContext(ctx)
	setSpanOutcome(span, err)
	return err
}

type txO11y struct {
	db.Tx
	finishTxSpan    func(string) trace.Span
	tracer          trace.Tracer
	driverName      string
	dbServerVersion string
}

func (x txO11y) startSpan(ctx context.Context, name string) (context.Context, trace.Span) {
	ctx, span := x.tracer.Start(ctx, name, spanOptKindClient)
	span.SetAttributes(consumeAttributes(ctx)...)
	span.SetAttributes(
		attribute.String(attrDriverName, x.driverName),
		attribute.String(attrServerVersion, x.dbServerVersion),
	)

	return ctx, span
}

func (x txO11y) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	ctx, span := x.startSpan(ctx, txTraceExecContext)
	defer span.End()
	res, err := x.Tx.ExecContext(ctx, query, args...)
	setSpanOutcome(span, err)

	return res, err
}

func (x txO11y) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	ctx, span := x.startSpan(ctx, txTraceQueryContext)
	defer span.End()
	rows, err := x.Tx.QueryContext(ctx, query, args...)
	setSpanOutcome(span, err)

	return rows, err
}

func (x txO11y) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	ctx, span := x.startSpan(ctx, txTraceQueryRowContext)
	defer span.End()
	row := x.Tx.QueryRowContext(ctx, query, args...)
	setSpanOutcome(span, row.Err())
	return row
}

func (x txO11y) Commit() error {
	span := x.finishTxSpan(txTraceCommit)
	defer span.End()
	err := x.Tx.Commit()
	setSpanOutcome(span, err)
	return err
}

func (x txO11y) Rollback() error {
	span := x.finishTxSpan(txTraceRollback)
	defer span.End()
	err := x.Tx.Rollback()
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

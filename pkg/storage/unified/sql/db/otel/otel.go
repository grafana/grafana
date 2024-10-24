package otel

import (
	"context"
	"database/sql"
	"sync"
	"time"

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
	dbTraceTx              = dbTracePrefix + "transaction"

	txTracePrefix          = "sql.db.tx."
	txTraceExecContext     = txTracePrefix + "exec_context"
	txTraceQueryContext    = txTracePrefix + "query_context"
	txTraceQueryRowContext = txTracePrefix + "query_row_context"
	txTraceCommit          = txTracePrefix + "commit"
	txTraceRollback        = txTracePrefix + "rollback"

	attrDriverName      = "driver_name"
	attrServerVersion   = "server_version"
	attrIsolationLevel  = "isolation_level"
	attrReadOnly        = "read_only"
	attrTxTerminationOp = "termination_op"

	attrValTxTerminationOpBegin    = "begin"
	attrValTxTerminationOpCommit   = "commit"
	attrValTxTerminationOpRollback = "rollback"
)

var (
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
//	// the following ExecContext operation will have a different extra attribute
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

type otelDB struct {
	db.DB
	withTxFunc db.WithTxFunc
	tracer     trace.Tracer
	driverName string

	initOnce        sync.Once
	dbServerVersion string
}

// NewInstrumentedDB wraps the given db.DB, instrumenting it to provide
// OTEL-based observability.
func NewInstrumentedDB(d db.DB, tracer trace.Tracer) db.DB {
	// TODO: periodically report metrics for stats returned by `db.Stats`

	ret := &otelDB{
		DB:              d,
		tracer:          tracer,
		driverName:      d.DriverName(),
		dbServerVersion: "unknown",
	}
	ret.withTxFunc = db.NewWithTxFunc(ret.BeginTx)
	return ret
}

func (x *otelDB) init(ctx context.Context) {
	x.initOnce.Do(func() {
		// there is a chance that the context of the first operation run on the
		// `*otelDB` has a very soon deadline, is cancelled by the client while
		// we use it, or is even already done. This would cause this operation,
		// which is run only once, to fail and we would no longer be able to
		// know the database details. Thus, we impose a long timeout that we
		// know is very likely to succeed, since getting the server version
		// should be nearly a nop. We could instead create a new context with
		// timeout from context.Background(), but we opt to derive one from the
		// provided context just in case any value in it would be meaningful to
		// the downstream implementation in `x.DB`. This is also to future-proof
		// this implementation for the case that we might have use another
		// decorator wrapping the actual implementation.
		const timeout = 5 * time.Second
		ctx = context.WithoutCancel(ctx)
		ctx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()

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

func (x *otelDB) startSpan(ctx context.Context, name string) (context.Context, trace.Span) {
	x.init(ctx)

	attrs := append(consumeAttributes(ctx),
		attribute.String(attrDriverName, x.driverName),
		attribute.String(attrServerVersion, x.dbServerVersion),
	)

	ctx, span := x.tracer.Start(ctx, name, spanOptKindClient,
		trace.WithAttributes(attrs...))

	return ctx, span
}

func (x *otelDB) ExecContext(ctx context.Context, query string, args ...any) (db.Result, error) {
	ctx, span := x.startSpan(ctx, dbTraceExecContext)
	defer span.End()
	res, err := x.DB.ExecContext(ctx, query, args...)
	setSpanOutcome(span, err)
	return res, err
}

func (x *otelDB) QueryContext(ctx context.Context, query string, args ...any) (db.Rows, error) {
	ctx, span := x.startSpan(ctx, dbTraceQueryContext)
	defer span.End()
	rows, err := x.DB.QueryContext(ctx, query, args...)
	setSpanOutcome(span, err)
	return rows, err
}

func (x *otelDB) QueryRowContext(ctx context.Context, query string, args ...any) db.Row {
	ctx, span := x.startSpan(ctx, dbTraceQueryRowContext)
	defer span.End()
	row := x.DB.QueryRowContext(ctx, query, args...)
	setSpanOutcome(span, row.Err())
	return row
}

func (x *otelDB) BeginTx(ctx context.Context, opts *sql.TxOptions) (db.Tx, error) {
	parentSpanID := trace.SpanFromContext(ctx).SpanContext().SpanID().String()

	// create a new span that will encompass the whole transaction as a single
	// operation. This span will be ended if we fail in BEGIN, or when COMMIT or
	// ROLLBACK are called on the returned instrumented db.Tx
	txCtx, txSpan := x.startSpan(ctx, dbTraceTx)
	setSpanTxOpts(txSpan, opts)

	// make sure to end the transaction span if BeginTx later fails
	var err error
	defer func() {
		if err != nil {
			txSpan.SetAttributes(attribute.String(attrTxTerminationOp,
				attrValTxTerminationOpBegin))
			setSpanOutcome(txSpan, err)
			txSpan.End()
		}
	}()

	ret := otelTx{
		// we only miss defining `tx` here, which is defined later
		span: txSpan, // will only be used during COMMIT/ROLLBACK
		tracerStartFunc: func(n string, o ...trace.SpanStartOption) trace.Span {
			_, span := x.tracer.Start(txCtx, n, o...)
			return span
		},
		parentSpanID: parentSpanID,
	}

	// start the span for BEGIN as a regular child span of the transaction span
	ctx, span := ret.startSpan(ctx, dbTraceBeginTx)
	defer span.End()
	ret.tx, err = x.DB.BeginTx(ctx, opts) // set ret.tx that we were missing
	setSpanOutcome(span, err)
	if err != nil {
		return nil, err
	}

	return ret, nil
}

func (x *otelDB) WithTx(ctx context.Context, opts *sql.TxOptions, f db.TxFunc) error {
	return x.withTxFunc(ctx, opts, f)
}

func (x *otelDB) PingContext(ctx context.Context) error {
	ctx, span := x.startSpan(ctx, dbTracePingContext)
	defer span.End()
	err := x.DB.PingContext(ctx)
	setSpanOutcome(span, err)
	return err
}

type otelTx struct {
	tx              db.Tx
	span            trace.Span
	tracerStartFunc func(string, ...trace.SpanStartOption) trace.Span
	parentSpanID    string
}

// startSpan returns a new span, and optionally a context.Context if
// `optionalCtx` is not nil. It will be nil in the cases of the `Commit` and
// `Rollback` methods, since they do not have a context.Context either. The
// returned span will be a child span of the transaction span started at the
// beginning of the transaction. If `optionalCtx` is not nil, then the returned
// span will also be linked to the span found in that context (if it differs from
// the one used to create the transaction).
//
// Example operation with additional spans with current implementation:
//
//	parentSpan
//	   |
//	   +------------------+
//	   |                  |
//	   |                  v
//	   |               exampleSubSpan
//	   |                  |
//	   |                  +-------------+
//	   |                  :             |
//	   v                  :             v
//	transactionSpan    (spanLink)    nonTxQuerySpan
//	   |                  :
//	   +------------------+-----------------------------+
//	   |                  |                             |
//	   v                  v                             v
//	beginTxSpan        execSpan                      commitSpan
//
// Note that understanding what is being executed in the same transaction is
// very clear because you just need to follow the vertical solid lines, which
// denote a parent-child relationship. We also know that the `execSpan` was
// originated in `exampleSubSpan` because of the spanLink (with a vertical
// dotted line), but there is no chance that we get confused and think that
// `nonTxQuerySpan` was part of the transaction (it is not related in any
// manner). What we do here is to make any transactional db operation a child of
// the transaction span, which aligns with the OTEL concept of a span being 'a
// unit of work'. In this sense, a transaction is our unit of work, which also
// aligns semantically with the database concept of transaction. This allows us
// to clearly visualize important database semantics within the OTEL framework.
// In OTEL, span links exist to associate one span with one or more spans,
// implying a causal relationship. In our case, we can see that while `execSpan`
// is part of the unit of work called "database transaction", it actually has a
// different cause: the `exampleSubSpan` for `execSpan`.
//
// For comparison, consider the following naïve alternative just passing the
// context around:
//
//	parentSpan                                       commitSpan
//	   |
//	   +------------------+
//	   |                  |
//	   v                  v
//	beginTxSpan      exampleSubSpan
//	                      |
//	                      +-------------+
//	                      |             |
//	                      v             v
//	                   execSpan      nonTxQuerySpan
//
// In this case, it is not straightforward to know what operations are part of
// the transaction. When looking at the traces, it will be very easy to be
// confused and think that `nonTxQuerySpan` was part of the transaction.
// Additionally, note that `commitSpan` is a root span, since the `Commit`
// method doesn't receive a context (same as `Rollback`), hence all such
// operations would end up being a scattered root span, making it hard to
// correlate.
func (x otelTx) startSpan(optionalCtx context.Context, name string) (context.Context, trace.Span) {
	// minimum number of options for the span
	startOpts := make([]trace.SpanStartOption, 0, 2)
	startOpts = append(startOpts, spanOptKindClient)

	if optionalCtx != nil {
		attrs := consumeAttributes(optionalCtx)
		spanLink := trace.LinkFromContext(optionalCtx, attrs...)
		if spanLink.SpanContext.SpanID().String() != x.parentSpanID {
			// it only makes sense to create a link to the span in `optionalCtx`
			// if it's not the same as the one used during BEGIN
			startOpts = append(startOpts, trace.WithLinks(spanLink))
		} else if len(attrs) > 0 {
			// otherwise, we just add the extra attributes added with
			// `SetAttributes`.
			startOpts = append(startOpts, trace.WithAttributes(attrs...))
		}
	}

	span := x.tracerStartFunc(name, startOpts...)

	if optionalCtx != nil {
		// we preserve the original intended context, we only override the span
		// with the one we created
		optionalCtx = trace.ContextWithSpan(optionalCtx, span)
	}

	return optionalCtx, span
}

func (x otelTx) ExecContext(ctx context.Context, query string, args ...any) (db.Result, error) {
	ctx, span := x.startSpan(ctx, txTraceExecContext)
	defer span.End()
	res, err := x.tx.ExecContext(ctx, query, args...)
	setSpanOutcome(span, err)

	return res, err
}

func (x otelTx) QueryContext(ctx context.Context, query string, args ...any) (db.Rows, error) {
	ctx, span := x.startSpan(ctx, txTraceQueryContext)
	defer span.End()
	rows, err := x.tx.QueryContext(ctx, query, args...)
	setSpanOutcome(span, err)

	return rows, err
}

func (x otelTx) QueryRowContext(ctx context.Context, query string, args ...any) db.Row {
	ctx, span := x.startSpan(ctx, txTraceQueryRowContext)
	defer span.End()
	row := x.tx.QueryRowContext(ctx, query, args...)
	setSpanOutcome(span, row.Err())
	return row
}

func (x otelTx) Commit() error {
	x.span.SetAttributes(attribute.String(attrTxTerminationOp,
		attrValTxTerminationOpCommit))
	defer x.span.End()
	_, span := x.startSpan(nil, txTraceCommit) //nolint:staticcheck
	defer span.End()
	err := x.tx.Commit()
	setSpanOutcome(span, err)
	setSpanOutcome(x.span, err)
	return err
}

func (x otelTx) Rollback() error {
	x.span.SetAttributes(attribute.String(attrTxTerminationOp,
		attrValTxTerminationOpRollback))
	defer x.span.End()
	_, span := x.startSpan(nil, txTraceRollback) //nolint:staticcheck
	defer span.End()
	err := x.tx.Rollback()
	setSpanOutcome(span, err)
	setSpanOutcome(x.span, err)
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
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "")
	}
}

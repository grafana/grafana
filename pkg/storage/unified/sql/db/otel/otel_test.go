package otel

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	sdktracetest "go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	dbmocks "github.com/grafana/grafana/pkg/storage/unified/sql/db/mocks"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var errTest = errors.New("because of reasons")

func TestContextAttributes(t *testing.T) {
	t.Parallel()

	// test context. Note that it's perfectly safe to use context.Background()
	// and there is no risk of the test blocking at any point because we will
	// not use the deadline or signal cancellation features of the context
	ctx := context.Background()

	// test attributes
	attr1 := attribute.String("the key", "the value")
	attr2 := attribute.String("the other key", "the other value")
	attr3 := attribute.String("why not", "have another value")
	attr4 := attribute.String("it's free", "they say")

	// the subtests are not Parallel because we define this test as a storyline,
	// since we are interested in testing state changes in the context

	t.Run("consumeAttributes returns nil if SetAttributes was never called",
		func(t *testing.T) {
			attrs := consumeAttributes(ctx)
			require.Nil(t, attrs)
		})

	t.Run("setting and getting attributes", func(t *testing.T) {
		ctx = SetAttributes(ctx, attr1, attr2)
		attrs := consumeAttributes(ctx)
		require.Len(t, attrs, 2)
		require.Equal(t, attr1, attrs[0])
		require.Equal(t, attr2, attrs[1])
	})

	t.Run("attributes are now cleared", func(t *testing.T) {
		attrs := consumeAttributes(ctx)
		require.Len(t, attrs, 0)
	})

	t.Run("SetAttributes overwrites previous attributes", func(t *testing.T) {
		ctx = SetAttributes(ctx, attr1, attr2)
		ctx = SetAttributes(ctx, attr3, attr4)
		attrs := consumeAttributes(ctx)
		require.Len(t, attrs, 2)
		require.Equal(t, attr3, attrs[0])
		require.Equal(t, attr4, attrs[1])
	})

	t.Run("attributes are now cleared again", func(t *testing.T) {
		attrs := consumeAttributes(ctx)
		require.Len(t, attrs, 0)
	})
}

func TestOTelTransactions(t *testing.T) {
	t.Parallel()
	const (
		rootSpanName     = "root of the operation"
		internalSpanName = "sub-operation"
	)
	ctx := context.Context(testutil.NewDefaultTestContext(t))
	d := newTestInstrumentedDB(ctx, t)
	mTx := dbmocks.NewTx(t)
	txOpts := &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
	}

	// create the root span
	ctx, rootSpan := d.tracer.Start(ctx, rootSpanName)

	// begin
	d.mock.EXPECT().BeginTx(mock.Anything, txOpts).Return(mTx, nil)
	tx, err := d.BeginTx(ctx, txOpts)
	require.NoError(t, err)

	// create a new span for the new operations
	ctx, internalSpan := d.tracer.Start(ctx, internalSpanName)

	// execute an operation within the transaction
	mTx.EXPECT().ExecContext(mock.Anything, mock.Anything).
		Return(dbmocks.NewResult(t), nil)
	res, err := tx.ExecContext(ctx, `DELETE FROM users; -- :)`)
	require.NoError(t, err)
	require.NotNil(t, res)

	// run a query concurrently outside of the transaction, but while the
	// transaction is still open
	d.mock.EXPECT().QueryContext(mock.Anything, mock.Anything).
		Return(dbmocks.NewRows(t), nil)
	rows, err := d.QueryContext(ctx, `SELECT * FROM users;`)
	require.NoError(t, err)
	require.NotNil(t, rows)

	internalSpan.End()

	// commit
	mTx.EXPECT().Commit().Return(nil)
	err = tx.Commit()
	require.NoError(t, err)

	rootSpan.End()

	// assert spans
	spanm := newSpanMap(d.tracer.Spans(ctx))
	require.Len(t, spanm, 7)

	// span creation order
	strictPartialOrder(t, spanm,
		rootSpanName,
		dbTraceTx,
		dbTraceBeginTx,
		internalSpanName,
		txTraceExecContext,
		dbTraceQueryContext,
		txTraceCommit,
	)

	// parent-child hierarchy relationships
	root(t, spanm, rootSpanName)
	directChildren(t, spanm, rootSpanName,
		dbTraceTx,
		internalSpanName,
	)
	directChildren(t, spanm, dbTraceTx,
		dbTraceBeginTx,
		txTraceExecContext,
		txTraceCommit,
	)
	directChildren(t, spanm, internalSpanName,
		dbTraceQueryContext,
	)

	// link relationships
	links(t, spanm, internalSpanName,
		txTraceExecContext,
	)
}

func TestOTelDB_PingContext(t *testing.T) {
	t.Parallel()

	t.Run("happy path - default DB version", func(t *testing.T) {
		t.Parallel()
		ctx := testutil.NewDefaultTestContext(t)
		db := newTestInstrumentedDBWithVersionSQL(ctx, t, dbVersionDefaultSQL)

		db.mock.EXPECT().PingContext(mock.Anything).Return(nil)

		err := db.PingContext(ctx)
		require.NoError(t, err)

		spans := db.tracer.Spans(ctx)
		require.Len(t, spans, 1)
		require.Equal(t, dbTracePingContext, spans[0].Name)

		v := getAttr(spans[0], attrServerVersion)
		require.Equal(t, attribute.StringValue(testDefaultDBVersion), v)
	})

	t.Run("happy path - SQLite DB version", func(t *testing.T) {
		t.Parallel()
		ctx := testutil.NewDefaultTestContext(t)
		db := newTestInstrumentedDBWithVersionSQL(ctx, t, dbVersionSQLiteSQL)

		db.mock.EXPECT().PingContext(mock.Anything).Return(nil)

		err := db.PingContext(ctx)
		require.NoError(t, err)

		spans := db.tracer.Spans(ctx)
		require.Len(t, spans, 1)
		require.Equal(t, dbTracePingContext, spans[0].Name)

		v := getAttr(spans[0], attrServerVersion)
		require.Equal(t, attribute.StringValue(testSQLiteDBVersion), v)
	})

	t.Run("happy path - unknown DB version", func(t *testing.T) {
		t.Parallel()
		ctx := testutil.NewDefaultTestContext(t)
		db := newTestInstrumentedDBWithVersionSQL(ctx, t, "")

		db.mock.EXPECT().PingContext(mock.Anything).Return(nil)

		err := db.PingContext(ctx)
		require.NoError(t, err)

		spans := db.tracer.Spans(ctx)
		require.Len(t, spans, 1)
		require.Equal(t, dbTracePingContext, spans[0].Name)

		v := getAttr(spans[0], attrServerVersion)
		require.Equal(t, attribute.StringValue("unknown"), v)
	})

	t.Run("fail making ping", func(t *testing.T) {
		t.Parallel()
		ctx := testutil.NewDefaultTestContext(t)
		db := newTestInstrumentedDBWithVersionSQL(ctx, t, "")

		db.mock.EXPECT().PingContext(mock.Anything).Return(errTest)

		err := db.PingContext(ctx)
		require.Error(t, err)
		require.ErrorIs(t, err, errTest)

		spans := db.tracer.Spans(ctx)
		require.Len(t, spans, 1)
		require.Equal(t, dbTracePingContext, spans[0].Name)

		v := getAttr(spans[0], attrServerVersion)
		require.Equal(t, attribute.StringValue("unknown"), v)
	})
}

const (
	testDriverName       = "mysql"
	testDefaultDBVersion = "8.0.39" // e.g. MySQL
	testSQLiteDBVersion  = "3.45.1"
)

type testOTelDB struct {
	mock   *dbmocks.DB
	tracer otelTestTracer
	db.DB
}

func newTestInstrumentedDB(ctx context.Context, t *testing.T) testOTelDB {
	return newTestInstrumentedDBWithVersionSQL(ctx, t, dbVersionDefaultSQL)
}

func newTestInstrumentedDBWithVersionSQL(ctx context.Context, t *testing.T, dbVersionSQL string) testOTelDB {
	tr := newTestOTelTracer(ctx, t)
	mDB := dbmocks.NewDB(t)
	row := dbmocks.NewRow(t)

	mDB.EXPECT().DriverName().Return(testDriverName).Once()
	mDB.EXPECT().QueryRowContext(mock.Anything, dbVersionDefaultSQL).Return(row)
	if dbVersionSQL == dbVersionDefaultSQL {
		row.EXPECT().Err().Return(nil)
		dbmocks.ExpectRowValues(t, row, testDefaultDBVersion)
	} else {
		row.EXPECT().Err().Return(errTest)
		row := dbmocks.NewRow(t)
		mDB.EXPECT().QueryRowContext(mock.Anything, dbVersionSQLiteSQL).Return(row)
		if dbVersionSQL == dbVersionSQLiteSQL {
			row.EXPECT().Err().Return(nil)
			dbmocks.ExpectRowValues(t, row, testSQLiteDBVersion)
		} else {
			row.EXPECT().Err().Return(errTest)
		}
	}

	return testOTelDB{
		mock:   mDB,
		tracer: tr,
		DB:     NewInstrumentedDB(mDB, tr),
	}
}

// otelTestTracer is a valid test trace.Tracer that records all spans as stubs.
// It has an additional method `Spans` that returns these stubs so that you can
// assert the correct behaviour of your instrumentation code.
type otelTestTracer struct {
	t        *testing.T
	exporter *sdktracetest.InMemoryExporter
	provider *sdktrace.TracerProvider
	trace.Tracer
}

// newTestOTelTracer returns a new otelTestTracer. The provided context will be
// used to automatically shutdown the trace.TracerProvider implmentation when
// the test exits.
func newTestOTelTracer(ctx context.Context, t *testing.T) otelTestTracer {
	exporter := sdktracetest.NewInMemoryExporter()
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)
	t.Cleanup(func() {
		err := provider.Shutdown(ctx)
		require.NoError(t, err)
	})
	return otelTestTracer{
		t:        t,
		exporter: exporter,
		provider: provider,
		Tracer:   provider.Tracer("testtracer"),
	}
}

// Spans returns all the stubs recorded so far. The provided context is used to
// first flush all spans.
func (t otelTestTracer) Spans(ctx context.Context) sdktracetest.SpanStubs {
	err := t.provider.ForceFlush(ctx)
	require.NoError(t.t, err)
	return t.exporter.GetSpans()
}

// getAttr returns the value of the first attribute in a span with the given
// key. Returns an invalid attribute if it was not found.
func getAttr(s sdktracetest.SpanStub, key string) attribute.Value {
	for _, attr := range s.Attributes {
		if attr.Key == attribute.Key(key) {
			return attr.Value
		}
	}
	return attribute.Value{} // of type attribute.INVALID
}

type spanMap = map[string]sdktracetest.SpanStub

func newSpanMap(spans sdktracetest.SpanStubs) spanMap {
	ret := make(map[string]sdktracetest.SpanStub, len(spans))
	for _, span := range spans {
		ret[span.Name] = span
	}
	return ret
}

func strictPartialOrder(t *testing.T, m spanMap, spanNames ...string) {
	t.Helper()
	visited := make(map[string]struct{}, len(spanNames))
	for i := 1; i < len(spanNames); i++ {
		curName, nextName := spanNames[i-1], spanNames[i]
		visited[curName] = struct{}{}
		visited[nextName] = struct{}{}

		cur, ok := m[curName]
		require.True(t, ok, "span %q not found", curName)
		next, ok := m[nextName]
		require.True(t, ok, "span %q not found", nextName)
		require.True(t, !next.StartTime.Before(cur.StartTime), "span with "+
			"name %q did not happen before %q", curName, nextName)
	}

	for spanName := range m {
		if _, ok := visited[spanName]; !ok {
			t.Errorf("untested span %q", spanName)
		}
	}
}

func root(t *testing.T, m spanMap, rootSpanNames ...string) {
	for _, rootSpanName := range rootSpanNames {
		rootSpan, ok := m[rootSpanName]
		require.True(t, ok, "root span %q not found", rootSpanName)
		require.False(t, rootSpan.Parent.IsValid(), "%q is not a root span",
			rootSpanName)
	}
}

func directChildren(t *testing.T, m spanMap, parentName string, childrenNames ...string) {
	parent, ok := m[parentName]
	require.True(t, ok, "parent span %q not found", parentName)
	for _, childName := range childrenNames {
		child, ok := m[childName]
		require.True(t, ok, "child span %q not found", child)
		require.True(t, parent.SpanContext.Equal(child.Parent),
			"%q is not a child of %q", childName, parentName)
	}
}

func links(t *testing.T, m spanMap, linkToName string, linkFromNames ...string) {
	linkTo, ok := m[linkToName]
	require.True(t, ok, "LinkTo span %q not found", linkToName)
	for _, linkFromName := range linkFromNames {
		linkFrom, ok := m[linkFromName]
		require.True(t, ok, "LinkFrom span %q not found", linkFromName)
		var found bool
		for i := 0; i < len(linkFrom.Links) && !found; i++ {
			found = linkFrom.Links[i].SpanContext.Equal(linkTo.SpanContext)
		}
		require.True(t, found, "%q is not linked to %q", linkFromName,
			linkToName)
	}
}

package tracing

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func TestFromContext_NoTracer_ReturnsNoop(t *testing.T) {
	// With nothing injected, FromContext must return a usable (no-op) tracer and
	// Start must not panic nor record a span.
	tracer := FromContext(context.Background())
	require.NotNil(t, tracer)

	_, span := Start(context.Background(), "op")
	defer span.End()
	assert.False(t, span.SpanContext().IsValid(), "expected a no-op span when no tracer is injected")
}

func TestWithTracer_NilIsIgnored(t *testing.T) {
	ctx := WithTracer(context.Background(), nil)
	// Still resolves to the no-op tracer rather than storing a nil tracer.
	_, span := Start(ctx, "op")
	span.End()
	assert.False(t, span.SpanContext().IsValid())
}

func TestFromContext_FallsBackToActiveSpanProvider(t *testing.T) {
	// No tracer injected, but the context carries an active span (as it would
	// during request handling): Start must nest under it via the span's provider.
	exporter := tracetest.NewInMemoryExporter()
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)
	t.Cleanup(func() { require.NoError(t, tp.Shutdown(context.Background())) })

	rootCtx, root := tp.Tracer("mw").Start(context.Background(), "request")
	_, child := Start(rootCtx, "child") // no WithTracer
	child.End()
	root.End()

	spans := exporter.GetSpans()
	require.Len(t, spans, 2)
	byName := map[string]tracetest.SpanStub{}
	for _, s := range spans {
		byName[s.Name] = s
	}
	require.Contains(t, byName, "child")
	assert.Equal(t, byName["request"].SpanContext.SpanID(), byName["child"].Parent.SpanID())
}

func TestStart_UsesInjectedTracer(t *testing.T) {
	exporter := tracetest.NewInMemoryExporter()
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)
	t.Cleanup(func() { require.NoError(t, tp.Shutdown(context.Background())) })

	// Inject at the "entrypoint": from here on, Start creates real spans, even
	// when the context carries no active span yet (i.e. a root span).
	ctx := WithTracer(context.Background(), tp.Tracer("test"))

	rootCtx, root := Start(ctx, "root")
	assert.True(t, root.SpanContext().IsValid(), "injected tracer must create a real root span")

	_, child := Start(rootCtx, "child")
	child.End()
	root.End()

	spans := exporter.GetSpans()
	require.Len(t, spans, 2)
	byName := map[string]tracetest.SpanStub{}
	for _, s := range spans {
		byName[s.Name] = s
	}
	require.Contains(t, byName, "root")
	require.Contains(t, byName, "child")
	assert.Equal(t, root.SpanContext().TraceID(), byName["child"].SpanContext.TraceID(), "child shares the root trace")
	assert.Equal(t, byName["root"].SpanContext.SpanID(), byName["child"].Parent.SpanID(), "child is parented to root")
}

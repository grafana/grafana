package utils

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

func TestSetTraceContext_NoSpan(t *testing.T) {
	got := SetTraceContext(context.Background(), map[string]string{"existing": "value"})
	assert.Equal(t, map[string]string{"existing": "value"}, got)
}

func TestSetTraceContext_NilAnnotations(t *testing.T) {
	got := SetTraceContext(context.Background(), nil)
	assert.Nil(t, got)
}

func TestSetAndExtractTraceContext_RoundTrip(t *testing.T) {
	tp := sdktrace.NewTracerProvider(sdktrace.WithSampler(sdktrace.AlwaysSample()))
	t.Cleanup(func() { _ = tp.Shutdown(context.Background()) })

	ctx, span := tp.Tracer("test").Start(context.Background(), "originating-request")
	defer span.End()
	wantTraceID := span.SpanContext().TraceID()

	annotations := SetTraceContext(ctx, nil)
	require.Contains(t, annotations, AnnoKeyTraceParent)

	extracted := ExtractTraceContext(context.Background(), annotations)
	sc := trace.SpanContextFromContext(extracted)
	require.True(t, sc.IsValid())
	assert.Equal(t, wantTraceID, sc.TraceID())
	assert.True(t, sc.IsRemote())
}

func TestExtractTraceContext_NoAnnotation(t *testing.T) {
	ctx := context.Background()
	got := ExtractTraceContext(ctx, nil)
	assert.Equal(t, ctx, got)
}

func TestExtractTraceContext_InvalidTraceparent(t *testing.T) {
	ctx := context.Background()
	got := ExtractTraceContext(ctx, map[string]string{AnnoKeyTraceParent: "not-a-valid-traceparent"})
	assert.Equal(t, ctx, got)
}

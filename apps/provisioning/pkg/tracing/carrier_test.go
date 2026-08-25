package tracing

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

func TestAnnotate_NoSpan(t *testing.T) {
	got := Annotate(context.Background(), map[string]string{"existing": "value"})
	assert.Equal(t, map[string]string{"existing": "value"}, got)
}

func TestAnnotate_NilAnnotations(t *testing.T) {
	got := Annotate(context.Background(), nil)
	assert.Nil(t, got)
}

func TestAnnotateAndExtractParent_RoundTrip(t *testing.T) {
	tp := sdktrace.NewTracerProvider(sdktrace.WithSampler(sdktrace.AlwaysSample()))
	t.Cleanup(func() { _ = tp.Shutdown(context.Background()) })

	ctx, span := tp.Tracer("test").Start(context.Background(), "originating-request")
	defer span.End()
	wantTraceID := span.SpanContext().TraceID()

	annotations := Annotate(ctx, nil)
	require.Contains(t, annotations, AnnoTraceParent)

	extracted := ExtractParent(context.Background(), annotations)
	sc := trace.SpanContextFromContext(extracted)
	require.True(t, sc.IsValid())
	assert.Equal(t, wantTraceID, sc.TraceID())
	assert.True(t, sc.IsRemote())
}

func TestExtractParent_NoAnnotation(t *testing.T) {
	ctx := context.Background()
	got := ExtractParent(ctx, nil)
	assert.Equal(t, ctx, got)
}

func TestExtractParent_InvalidTraceparent(t *testing.T) {
	ctx := context.Background()
	got := ExtractParent(ctx, map[string]string{AnnoTraceParent: "not-a-valid-traceparent"})
	assert.Equal(t, ctx, got)
}

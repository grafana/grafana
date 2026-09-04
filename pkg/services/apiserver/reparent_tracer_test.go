package apiserver

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	oteltrace "go.opentelemetry.io/otel/trace"
)

func remoteSpanContext(t *testing.T) oteltrace.SpanContext {
	t.Helper()
	tid, err := oteltrace.TraceIDFromHex("0102030405060708090a0b0c0d0e0f10")
	require.NoError(t, err)
	sid, err := oteltrace.SpanIDFromHex("0102030405060708")
	require.NoError(t, err)
	return oteltrace.NewSpanContext(oteltrace.SpanContextConfig{
		TraceID:    tid,
		SpanID:     sid,
		TraceFlags: oteltrace.FlagsSampled,
		Remote:     true,
	})
}

func newRecordingProvider(t *testing.T) (oteltrace.TracerProvider, *tracetest.SpanRecorder) {
	t.Helper()
	sr := tracetest.NewSpanRecorder()
	base := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(sr))
	t.Cleanup(func() { _ = base.Shutdown(context.Background()) })
	return newReparentingTracerProvider(base), sr
}

// publicEndpointStart mimics the span-start options otelhttp emits in
// public-endpoint mode: a new root plus the incoming remote context as a link.
func publicEndpointStart(remote oteltrace.SpanContext) []oteltrace.SpanStartOption {
	return []oteltrace.SpanStartOption{
		oteltrace.WithAttributes(attribute.String("http.method", "GET")),
		oteltrace.WithSpanKind(oteltrace.SpanKindServer),
		oteltrace.WithNewRoot(),
		oteltrace.WithLinks(oteltrace.Link{SpanContext: remote}),
	}
}

func TestReparentingTracer(t *testing.T) {
	t.Run("re-parents a public-endpoint new-root span onto the remote context", func(t *testing.T) {
		tp, sr := newRecordingProvider(t)
		remote := remoteSpanContext(t)

		_, span := tp.Tracer("test").Start(context.Background(), "KubernetesAPI", publicEndpointStart(remote)...)
		span.End()

		ended := sr.Ended()
		require.Len(t, ended, 1)
		got := ended[0]

		// The span continues the client's trace and is parented to the remote span.
		require.Equal(t, remote.TraceID(), got.SpanContext().TraceID(), "should continue the incoming trace")
		require.Equal(t, remote.SpanID(), got.Parent().SpanID(), "should be parented to the remote span")
		require.True(t, got.Parent().IsRemote())

		// Other start options are preserved and the consumed remote link is dropped.
		require.Equal(t, oteltrace.SpanKindServer, got.SpanKind())
		require.Empty(t, got.Links(), "the remote link becomes the parent and is not kept as a link")
		require.Contains(t, got.Attributes(), attribute.String("http.method", "GET"))
	})

	t.Run("leaves a plain new-root span (no remote link) untouched", func(t *testing.T) {
		tp, sr := newRecordingProvider(t)

		_, span := tp.Tracer("test").Start(context.Background(), "root", oteltrace.WithNewRoot())
		span.End()

		got := sr.Ended()[0]
		require.False(t, got.Parent().IsValid(), "should remain a root span")
	})

	t.Run("ignores a non-remote link on a new-root span", func(t *testing.T) {
		tp, sr := newRecordingProvider(t)
		local := oteltrace.NewSpanContext(oteltrace.SpanContextConfig{
			TraceID: remoteSpanContext(t).TraceID(),
			SpanID:  remoteSpanContext(t).SpanID(),
			// Remote is false: an ordinary link, not an incoming trace context.
		})

		_, span := tp.Tracer("test").Start(context.Background(), "root",
			oteltrace.WithNewRoot(),
			oteltrace.WithLinks(oteltrace.Link{SpanContext: local}),
		)
		span.End()

		got := sr.Ended()[0]
		require.False(t, got.Parent().IsValid(), "non-remote links must not trigger re-parenting")
		require.Len(t, got.Links(), 1, "the link is preserved")
	})

	t.Run("does not alter a normal parented span", func(t *testing.T) {
		tp, sr := newRecordingProvider(t)
		remote := remoteSpanContext(t)
		ctx := oteltrace.ContextWithRemoteSpanContext(context.Background(), remote)

		_, span := tp.Tracer("test").Start(ctx, "child", oteltrace.WithSpanKind(oteltrace.SpanKindServer))
		span.End()

		got := sr.Ended()[0]
		require.Equal(t, remote.TraceID(), got.SpanContext().TraceID())
		require.Equal(t, remote.SpanID(), got.Parent().SpanID())
	})
}

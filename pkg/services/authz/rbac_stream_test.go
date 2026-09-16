package authz

import (
	"context"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/stretchr/testify/require"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	oteltrace "go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	grpc_health_v1 "google.golang.org/grpc/health/grpc_health_v1"
)

func TestInProcessStreamInterceptorPropagatesClientSpan(t *testing.T) {
	spanContexts := make(chan oteltrace.SpanContext, 1)
	captureSpan := func(srv any, stream grpc.ServerStream, _ *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		spanContexts <- oteltrace.SpanContextFromContext(stream.Context())
		return handler(srv, stream)
	}

	channel := (&inprocgrpc.Channel{}).WithServerStreamInterceptor(inProcessStreamInterceptor(captureSpan))
	grpc_health_v1.RegisterHealthServer(channel, health.NewServer())

	provider := sdktrace.NewTracerProvider()
	t.Cleanup(func() { require.NoError(t, provider.Shutdown(context.Background())) })
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	ctx, parent := provider.Tracer("test").Start(ctx, "client")
	defer parent.End()

	stream, err := grpc_health_v1.NewHealthClient(channel).Watch(ctx, &grpc_health_v1.HealthCheckRequest{})
	require.NoError(t, err)
	_, err = stream.Recv()
	require.NoError(t, err)

	got := <-spanContexts
	require.True(t, got.IsRemote())
	require.Equal(t, parent.SpanContext().TraceID(), got.TraceID())
	require.Equal(t, parent.SpanContext().SpanID(), got.SpanID())
}

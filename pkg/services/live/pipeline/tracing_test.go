package pipeline

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	collectortrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/grpc"
)

type traceReceiver struct {
	collectortrace.UnimplementedTraceServiceServer
	requests chan *collectortrace.ExportTraceServiceRequest
}

func (r *traceReceiver) Export(_ context.Context, req *collectortrace.ExportTraceServiceRequest) (*collectortrace.ExportTraceServiceResponse, error) {
	r.requests <- req
	return &collectortrace.ExportTraceServiceResponse{}, nil
}

func TestTracerProviderExportsOTLP(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	server := grpc.NewServer()
	receiver := &traceReceiver{requests: make(chan *collectortrace.ExportTraceServiceRequest, 1)}
	collectortrace.RegisterTraceServiceServer(server, receiver)
	t.Cleanup(server.Stop)
	go func() { _ = server.Serve(listener) }()

	t.Setenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "http://"+listener.Addr().String())
	t.Setenv("OTEL_TRACES_SAMPLER", "always_on")
	tp, err := tracerProvider()
	require.NoError(t, err)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		require.NoError(t, tp.Shutdown(ctx))
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, span := tp.Tracer("gf.live.pipeline").Start(ctx, "pipeline-test")
	span.End()
	require.NoError(t, tp.ForceFlush(ctx))

	select {
	case req := <-receiver.requests:
		require.Len(t, req.ResourceSpans, 1)
		resource := req.ResourceSpans[0]
		require.Len(t, resource.ScopeSpans, 1)
		require.Equal(t, "gf.live.pipeline", resource.ScopeSpans[0].Scope.Name)
		require.Len(t, resource.ScopeSpans[0].Spans, 1)
		require.Equal(t, "pipeline-test", resource.ScopeSpans[0].Spans[0].Name)
		attrs := map[string]string{}
		for _, attr := range resource.Resource.Attributes {
			attrs[attr.Key] = attr.Value.GetStringValue()
		}
		require.Equal(t, "grafana", attrs["service.name"])
	case <-ctx.Done():
		t.Fatal("OTLP receiver did not receive spans")
	}
}

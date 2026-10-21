package unified

import (
	"context"
	"fmt"
	"net"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/resolver"
	"google.golang.org/grpc/resolver/manual"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestGRPCConnHealthInitiallyNotServing(t *testing.T) {
	server := startClientHealthServer(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, true)
	conn := newClientHealthConn(t, server.address)

	ctx, cancel := context.WithTimeout(t.Context(), 500*time.Millisecond)
	defer cancel()
	_, err := resourcepb.NewDiagnosticsClient(conn).IsHealthy(ctx, &resourcepb.HealthCheckRequest{}, grpc.WaitForReady(true)) //nolint:staticcheck
	assert.Equal(t, codes.DeadlineExceeded, status.Code(err), "requests must wait while the endpoint is NOT_SERVING")
	require.Zero(t, server.calls.Load(), "an unhealthy endpoint must not receive application requests")
}

func TestGRPCConnHealthTransitions(t *testing.T) {
	server := startClientHealthServer(t, grpc_health_v1.HealthCheckResponse_SERVING, true)
	conn := newClientHealthConn(t, server.address)
	requireClientHealthRPC(t, conn)

	server.health.SetServingStatus("", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
	require.Eventually(t, func() bool {
		return conn.GetState() == connectivity.TransientFailure
	}, 5*time.Second, 10*time.Millisecond, "NOT_SERVING must remove the only endpoint from the ready picker")

	before := server.calls.Load()
	ctx, cancel := context.WithTimeout(t.Context(), 500*time.Millisecond)
	defer cancel()
	_, err := resourcepb.NewDiagnosticsClient(conn).IsHealthy(ctx, &resourcepb.HealthCheckRequest{}, grpc.WaitForReady(true)) //nolint:staticcheck
	require.Equal(t, codes.DeadlineExceeded, status.Code(err))
	require.Equal(t, before, server.calls.Load())

	server.health.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)
	requireClientHealthRPC(t, conn)
	require.Equal(t, before+1, server.calls.Load(), "a recovered endpoint must receive requests again")
}

func TestGRPCConnHealthBalancesOnlyServingEndpoints(t *testing.T) {
	first := startClientHealthServer(t, grpc_health_v1.HealthCheckResponse_SERVING, true)
	second := startClientHealthServer(t, grpc_health_v1.HealthCheckResponse_SERVING, true)
	conn := newClientHealthConn(t, first.address, second.address)

	requireClientHealthEventually(t, func() bool {
		requireClientHealthRPC(t, conn)
		return first.calls.Load() > 0 && second.calls.Load() > 0
	}, "both healthy endpoints must participate in round robin")

	first.health.SetServingStatus("", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
	requireClientHealthEventually(t, func() bool {
		before := first.calls.Load()
		for range 10 {
			requireClientHealthRPC(t, conn)
		}
		return first.calls.Load() == before
	}, "requests must move exclusively to the remaining healthy endpoint")

	before := first.calls.Load()
	first.health.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)
	requireClientHealthEventually(t, func() bool {
		requireClientHealthRPC(t, conn)
		return first.calls.Load() > before
	}, "a recovered endpoint must rejoin round robin")
}

func TestGRPCConnHealthUnimplementedCompatibility(t *testing.T) {
	server := startClientHealthServer(t, grpc_health_v1.HealthCheckResponse_SERVING, false)
	conn := newClientHealthConn(t, server.address)

	requireClientHealthRPC(t, conn)
	require.Equal(t, int64(1), server.calls.Load(), "servers without the health service must remain usable")
}

func TestGRPCConnHealthGracefulShutdown(t *testing.T) {
	server := startClientHealthServer(t, grpc_health_v1.HealthCheckResponse_SERVING, true)
	conn := newClientHealthConn(t, server.address)
	requireClientHealthRPC(t, conn)

	server.health.Shutdown()
	done := make(chan struct{})
	go func() {
		server.grpc.GracefulStop()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("automatic health watches must not block graceful shutdown")
	}
}

type clientHealthServer struct {
	resourcepb.UnimplementedDiagnosticsServer
	address string
	grpc    *grpc.Server
	health  *health.Server
	calls   atomic.Int64
}

func (s *clientHealthServer) IsHealthy(context.Context, *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	s.calls.Add(1)
	return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_SERVING}, nil
}

func startClientHealthServer(t *testing.T, serving grpc_health_v1.HealthCheckResponse_ServingStatus, registerHealth bool) *clientHealthServer {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	s := &clientHealthServer{address: listener.Addr().String(), grpc: grpc.NewServer(), health: health.NewServer()}
	s.health.SetServingStatus("", serving)
	if registerHealth {
		grpc_health_v1.RegisterHealthServer(s.grpc, s.health)
	}
	resourcepb.RegisterDiagnosticsServer(s.grpc, s)
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = s.grpc.Serve(listener)
	}()
	t.Cleanup(func() {
		s.grpc.Stop()
		_ = listener.Close()
		<-done
	})
	return s
}

var clientHealthResolverID atomic.Uint64

func newClientHealthConn(t *testing.T, addresses ...string) *grpc.ClientConn {
	t.Helper()
	// A unique resolver lets the production constructor discover multiple endpoints
	// without DNS or test-only dial options.
	r := manual.NewBuilderWithScheme(fmt.Sprintf("unified-health-%d", clientHealthResolverID.Add(1)))
	state := resolver.State{}
	for _, address := range addresses {
		state.Addresses = append(state.Addresses, resolver.Address{Addr: address})
	}
	r.InitialState(state)
	resolver.Register(r)
	conn, err := grpcConn(r.Scheme()+":///test", newClientMetrics(prometheus.NewRegistry()), 0)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })
	return conn
}

// Run RPC assertions on the test goroutine so a failed assertion finishes before
// cleanup closes the connection.
func requireClientHealthEventually(t *testing.T, condition func() bool, message string) {
	t.Helper()
	timer := time.NewTimer(5 * time.Second)
	defer timer.Stop()
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	for {
		if condition() {
			return
		}
		select {
		case <-timer.C:
			t.Fatal(message)
		case <-ticker.C:
		}
	}
}

func requireClientHealthRPC(t *testing.T, conn *grpc.ClientConn) {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	_, err := resourcepb.NewDiagnosticsClient(conn).IsHealthy(ctx, &resourcepb.HealthCheckRequest{}, grpc.WaitForReady(true)) //nolint:staticcheck
	require.NoError(t, err)
}

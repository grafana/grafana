package grpcserver

import (
	"context"
	"net"
	"sync"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
)

type healthCall struct {
	name  string
	route string
	call  func(context.Context, grpc_health_v1.HealthClient) error
}

var healthCalls = []healthCall{
	{
		name:  "unary",
		route: "/grpc.health.v1.Health/Check",
		call: func(ctx context.Context, client grpc_health_v1.HealthClient) error {
			_, err := client.Check(ctx, &grpc_health_v1.HealthCheckRequest{})
			return err
		},
	},
	{
		name:  "stream",
		route: "/grpc.health.v1.Health/Watch",
		call: func(ctx context.Context, client grpc_health_v1.HealthClient) error {
			stream, err := client.Watch(ctx, &grpc_health_v1.HealthCheckRequest{})
			if err != nil {
				return err
			}
			_, err = stream.Recv()
			return err
		},
	},
}

func TestInterceptorsRecordRejectedRequests(t *testing.T) {
	for _, tc := range healthCalls {
		t.Run(tc.name, func(t *testing.T) {
			reg := withFreshServerMetrics(t)
			authenticating := make(chan struct{})
			release := make(chan struct{})
			client := startInterceptorTestServer(t, reg, "test", interceptors.AuthenticatorFunc(func(context.Context) (context.Context, error) {
				authenticating <- struct{}{}
				<-release
				return nil, status.Error(codes.Unauthenticated, "rejected")
			}))

			const requests = 3
			var wg sync.WaitGroup
			for range requests {
				wg.Go(func() {
					err := tc.call(t.Context(), client)
					assert.Equal(t, codes.Unauthenticated, status.Code(err))
				})
			}
			// All requests are blocked in authentication before any is rejected,
			// so they arrive to find 0, 1, and 2 others already running.
			for range requests {
				<-authenticating
			}
			close(release)
			wg.Wait()

			arrivals := requireHistogram(t, reg, "grafana_grpc_requests_in_flight_at_arrival", map[string]string{"route": tc.route})
			require.Equal(t, uint64(requests), arrivals.GetSampleCount())
			require.Equal(t, float64(0+1+2), arrivals.GetSampleSum())
			durations := requireHistogram(t, reg, "grafana_grpc_request_duration_seconds", map[string]string{"route": tc.route, "status_code": "error"})
			require.Equal(t, uint64(requests), durations.GetSampleCount())
		})
	}
}

func TestInterceptorsRecoverAuthenticationPanics(t *testing.T) {
	for _, tc := range healthCalls {
		t.Run(tc.name, func(t *testing.T) {
			reg := withFreshServerMetrics(t)
			client := startInterceptorTestServer(t, reg, "test", interceptors.AuthenticatorFunc(func(context.Context) (context.Context, error) {
				panic("authenticator panic")
			}))

			for range 2 {
				err := tc.call(t.Context(), client)
				require.Equal(t, codes.Internal, status.Code(err))
			}

			// The panicking request must stop counting toward later arrivals.
			arrivals := requireHistogram(t, reg, "grafana_grpc_requests_in_flight_at_arrival", map[string]string{"route": tc.route})
			require.Equal(t, uint64(2), arrivals.GetSampleCount())
			require.Zero(t, arrivals.GetSampleSum())
		})
	}
}

func TestInterceptorsReportPerServer(t *testing.T) {
	allow := interceptors.AuthenticatorFunc(func(ctx context.Context) (context.Context, error) { return ctx, nil })
	check := func(t *testing.T, client grpc_health_v1.HealthClient, calls int) {
		t.Helper()
		for range calls {
			_, err := client.Check(t.Context(), &grpc_health_v1.HealthCheckRequest{})
			require.NoError(t, err)
		}
	}
	const route = "/grpc.health.v1.Health/Check"

	t.Run("separate registries", func(t *testing.T) {
		regA := withFreshServerMetrics(t)
		regB := prometheus.NewRegistry()
		check(t, startInterceptorTestServer(t, regA, "a", allow), 1)
		check(t, startInterceptorTestServer(t, regB, "b", allow), 2)

		require.Equal(t, uint64(1), requireHistogram(t, regA, "grafana_grpc_requests_in_flight_at_arrival", map[string]string{"route": route}).GetSampleCount())
		require.Equal(t, uint64(2), requireHistogram(t, regB, "grafana_grpc_requests_in_flight_at_arrival", map[string]string{"route": route}).GetSampleCount())
	})

	t.Run("shared registry", func(t *testing.T) {
		// Core Grafana and a dskit gRPC server can share a registerer in one process.
		reg := withFreshServerMetrics(t)
		check(t, startInterceptorTestServer(t, reg, "a", allow), 1)
		check(t, startInterceptorTestServer(t, reg, "b", allow), 2)

		require.Equal(t, uint64(1), requireHistogram(t, reg, "grafana_grpc_requests_in_flight_at_arrival", map[string]string{"route": route, "component": "a"}).GetSampleCount())
		require.Equal(t, uint64(2), requireHistogram(t, reg, "grafana_grpc_requests_in_flight_at_arrival", map[string]string{"route": route, "component": "b"}).GetSampleCount())
	})
}

func TestProvideServiceWithComponent(t *testing.T) {
	reg := withFreshServerMetrics(t)
	tracer := noop.NewTracerProvider().Tracer("")
	_, err := ProvideService(setting.NewCfg(), nil, tracer, reg)
	require.NoError(t, err)
	_, err = ProvideServiceWithComponent(setting.NewCfg(), nil, tracer, reg, "other")
	require.NoError(t, err, "servers with distinct components can share a registerer")
	require.Panics(t, func() {
		_, _ = ProvideServiceWithComponent(setting.NewCfg(), nil, tracer, reg, "other")
	}, "wiring the same component twice must fail loudly")
}

// withFreshServerMetrics makes the next server register its process-wide
// request duration metric on a new registry, restoring it afterwards.
func withFreshServerMetrics(t *testing.T) *prometheus.Registry {
	t.Helper()
	previous := grpcRequestDuration
	grpcRequestDuration = nil
	t.Cleanup(func() { grpcRequestDuration = previous })
	return prometheus.NewRegistry()
}

func startInterceptorTestServer(t *testing.T, reg prometheus.Registerer, component string, authenticator interceptors.Authenticator) grpc_health_v1.HealthClient {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	service, err := provideService(setting.NewCfg(), authenticator, noop.NewTracerProvider().Tracer(""), reg, component, false, listener)
	require.NoError(t, err)
	grpc_health_v1.RegisterHealthServer(service.server, &testHealthServer{})
	served := make(chan error, 1)
	go func() { served <- service.server.Serve(listener) }()
	t.Cleanup(func() {
		service.server.Stop()
		require.NoError(t, <-served)
	})

	conn, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })
	return grpc_health_v1.NewHealthClient(conn)
}

// requireHistogram returns the histogram series of a family whose labels include all of want.
func requireHistogram(t *testing.T, reg *prometheus.Registry, name string, want map[string]string) *dto.Histogram {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, family := range families {
		if family.GetName() != name {
			continue
		}
	series:
		for _, metric := range family.GetMetric() {
			labels := map[string]string{}
			for _, label := range metric.GetLabel() {
				labels[label.GetName()] = label.GetValue()
			}
			for key, value := range want {
				if labels[key] != value {
					continue series
				}
			}
			return metric.GetHistogram()
		}
	}
	t.Fatalf("no %s series with labels %v", name, want)
	return nil
}

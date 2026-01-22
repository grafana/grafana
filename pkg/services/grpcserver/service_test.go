package grpcserver

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestGracefulShutdown(t *testing.T) {
	t.Run("graceful shutdown completes before timeout", func(t *testing.T) {
		// Setup
		cfg := &setting.GRPCServerSettings{
			Network:                 "tcp",
			Address:                 "127.0.0.1:0", // Use port 0 to get a random available port
			GracefulShutdownTimeout: 5 * time.Second,
		}

		service := &gPRCServerService{
			cfg:         *cfg,
			logger:      log.NewNopLogger(),
			enabled:     true,
			startedChan: make(chan struct{}),
			server:      grpc.NewServer(),
		}

		// Register health service to have something to call
		grpc_health_v1.RegisterHealthServer(service.server, &testHealthServer{})

		// Start the server in a goroutine
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		serverDone := make(chan error, 1)
		go func() {
			serverDone <- service.Run(ctx)
		}()

		// Wait for server to start
		<-service.startedChan

		// Create a client connection to verify server is running
		conn, err := grpc.NewClient(
			service.GetAddress(),
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		)
		require.NoError(t, err)
		defer func() {
			err := conn.Close()
			require.NoError(t, err)
		}()

		// Make a health check call to ensure server is working
		healthClient := grpc_health_v1.NewHealthClient(conn)
		_, err = healthClient.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{})
		require.NoError(t, err)

		// Trigger shutdown
		shutdownStart := time.Now()
		cancel()

		// Wait for shutdown to complete
		err = <-serverDone
		shutdownDuration := time.Since(shutdownStart)

		// Assertions
		assert.NoError(t, err)
		assert.Less(t, shutdownDuration, cfg.GracefulShutdownTimeout,
			"Shutdown should complete before timeout")
		assert.Greater(t, shutdownDuration, time.Duration(0),
			"Shutdown should take some time")

		// Verify server is actually stopped by attempting another call
		ctx, cancel = context.WithTimeout(context.Background(), 1*time.Second)
		defer cancel()
		_, err = healthClient.Check(ctx, &grpc_health_v1.HealthCheckRequest{})
		assert.Error(t, err, "Server should not accept new connections after shutdown")
	})

	t.Run("graceful shutdown times out and forces stop", func(t *testing.T) {
		// Setup with very short timeout
		cfg := &setting.GRPCServerSettings{
			Network:                 "tcp",
			Address:                 "127.0.0.1:0",
			GracefulShutdownTimeout: 100 * time.Millisecond, // Very short timeout
		}

		service := &gPRCServerService{
			cfg:         *cfg,
			logger:      log.NewNopLogger(),
			enabled:     true,
			startedChan: make(chan struct{}),
			server:      grpc.NewServer(),
		}

		grpc_health_v1.RegisterHealthServer(service.server, &testHealthServer{})

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		serverDone := make(chan error, 1)
		go func() {
			serverDone <- service.Run(ctx)
		}()

		<-service.startedChan

		// Create a long-running streaming call that won't finish quickly
		conn, err := grpc.NewClient(
			service.GetAddress(),
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		)
		require.NoError(t, err)
		defer func() {
			err := conn.Close()
			require.NoError(t, err)
		}()

		healthClient := grpc_health_v1.NewHealthClient(conn)

		// Start a watch that simulates a hanging connection
		streamCtx, streamCancel := context.WithCancel(context.Background())
		defer streamCancel()

		stream, err := healthClient.Watch(streamCtx, &grpc_health_v1.HealthCheckRequest{})
		require.NoError(t, err)

		// Trigger shutdown while stream is active
		shutdownStart := time.Now()
		cancel()

		// Wait for shutdown to complete
		err = <-serverDone
		shutdownDuration := time.Since(shutdownStart)

		// Assertions
		assert.NoError(t, err)
		// Should timeout and force stop, taking approximately the timeout duration
		assert.GreaterOrEqual(t, shutdownDuration, cfg.GracefulShutdownTimeout,
			"Should wait for graceful shutdown timeout")
		assert.Less(t, shutdownDuration, cfg.GracefulShutdownTimeout+500*time.Millisecond,
			"Should force stop shortly after timeout")

		// Stream should be terminated (may or may not error depending on timing)
		_, _ = stream.Recv()
	})

	t.Run("handles server startup failure", func(t *testing.T) {
		// Try to bind to an invalid address
		cfg := &setting.GRPCServerSettings{
			Network:                 "tcp",
			Address:                 "999.999.999.999:0", // Invalid address
			GracefulShutdownTimeout: 5 * time.Second,
		}

		service := &gPRCServerService{
			cfg:         *cfg,
			logger:      log.NewNopLogger(),
			enabled:     true,
			startedChan: make(chan struct{}),
			server:      grpc.NewServer(),
		}

		ctx := context.Background()
		err := service.Run(ctx)

		// Should return error immediately without hanging
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to listen")
	})

	t.Run("context cancellation is respected", func(t *testing.T) {
		cfg := &setting.GRPCServerSettings{
			Network:                 "tcp",
			Address:                 "127.0.0.1:0",
			GracefulShutdownTimeout: 5 * time.Second,
		}

		service := &gPRCServerService{
			cfg:         *cfg,
			logger:      log.NewNopLogger(),
			enabled:     true,
			startedChan: make(chan struct{}),
			server:      grpc.NewServer(),
		}

		grpc_health_v1.RegisterHealthServer(service.server, &testHealthServer{})

		// Create a context with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		serverDone := make(chan error, 1)
		go func() {
			serverDone <- service.Run(ctx)
		}()

		<-service.startedChan

		// Wait for context to expire
		<-ctx.Done()

		// Server should stop gracefully
		err := <-serverDone
		assert.NoError(t, err)
	})

	t.Run("multiple concurrent clients shutdown cleanly", func(t *testing.T) {
		cfg := &setting.GRPCServerSettings{
			Network:                 "tcp",
			Address:                 "127.0.0.1:0",
			GracefulShutdownTimeout: 5 * time.Second,
		}

		service := &gPRCServerService{
			cfg:         *cfg,
			logger:      log.NewNopLogger(),
			enabled:     true,
			startedChan: make(chan struct{}),
			server:      grpc.NewServer(),
		}

		grpc_health_v1.RegisterHealthServer(service.server, &testHealthServer{})

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		serverDone := make(chan error, 1)
		go func() {
			serverDone <- service.Run(ctx)
		}()

		<-service.startedChan

		// Create multiple client connections
		for i := 0; i < 5; i++ {
			conn, err := grpc.NewClient(
				service.GetAddress(),
				grpc.WithTransportCredentials(insecure.NewCredentials()),
			)
			require.NoError(t, err)
			defer func() {
				err := conn.Close()
				require.NoError(t, err)
			}()

			// Make a call to ensure connection is established
			healthClient := grpc_health_v1.NewHealthClient(conn)
			_, err = healthClient.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{})
			require.NoError(t, err)
		}

		// Trigger shutdown
		cancel()

		// Should return without error
		err := <-serverDone
		assert.NoError(t, err)
	})
}

func TestGetAddress(t *testing.T) {
	t.Run("blocks until server starts", func(t *testing.T) {
		service := &gPRCServerService{
			startedChan: make(chan struct{}),
			address:     "127.0.0.1:9999",
		}

		// Start a goroutine that gets the address
		addressChan := make(chan string, 1)
		go func() {
			addressChan <- service.GetAddress()
		}()

		// Should block initially
		select {
		case <-addressChan:
			t.Fatal("GetAddress should block until server starts")
		case <-time.After(100 * time.Millisecond):
			// Expected - still blocking
		}

		// Close the started channel
		close(service.startedChan)

		// Now should get the address
		select {
		case addr := <-addressChan:
			assert.Equal(t, "127.0.0.1:9999", addr)
		case <-time.After(1 * time.Second):
			t.Fatal("GetAddress should return after server starts")
		}
	})
}

func TestIsDisabled(t *testing.T) {
	tests := []struct {
		name    string
		enabled bool
		want    bool
	}{
		{
			name:    "enabled service",
			enabled: true,
			want:    false,
		},
		{
			name:    "disabled service",
			enabled: false,
			want:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := &gPRCServerService{
				enabled: tt.enabled,
			}
			assert.Equal(t, tt.want, service.IsDisabled())
		})
	}
}

// testHealthServer implements a simple health check server for testing
type testHealthServer struct {
	grpc_health_v1.UnimplementedHealthServer
}

func (h *testHealthServer) Check(ctx context.Context, req *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
	return &grpc_health_v1.HealthCheckResponse{
		Status: grpc_health_v1.HealthCheckResponse_SERVING,
	}, nil
}

func (h *testHealthServer) Watch(req *grpc_health_v1.HealthCheckRequest, stream grpc_health_v1.Health_WatchServer) error {
	// Send initial status
	if err := stream.Send(&grpc_health_v1.HealthCheckResponse{
		Status: grpc_health_v1.HealthCheckResponse_SERVING,
	}); err != nil {
		return err
	}

	// Block until context is cancelled (simulates long-running stream)
	<-stream.Context().Done()
	return stream.Context().Err()
}

// BenchmarkGracefulShutdown benchmarks the graceful shutdown process
func BenchmarkGracefulShutdown(b *testing.B) {
	for i := 0; i < b.N; i++ {
		cfg := &setting.GRPCServerSettings{
			Network:                 "tcp",
			Address:                 "127.0.0.1:0",
			GracefulShutdownTimeout: 5 * time.Second,
		}

		service := &gPRCServerService{
			cfg:         *cfg,
			logger:      log.NewNopLogger(),
			enabled:     true,
			startedChan: make(chan struct{}),
			server:      grpc.NewServer(),
		}

		grpc_health_v1.RegisterHealthServer(service.server, &testHealthServer{})

		ctx, cancel := context.WithCancel(context.Background())
		serverDone := make(chan error, 1)

		go func() {
			serverDone <- service.Run(ctx)
		}()

		<-service.startedChan
		cancel()
		<-serverDone
	}
}

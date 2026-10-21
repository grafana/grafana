package options

import (
	"context"
	"net"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestStorageOptionsHealthChecking(t *testing.T) {
	for _, initiallyServing := range []bool{false, true} {
		name := "initially unhealthy"
		if initiallyServing {
			name = "becomes unhealthy"
		}
		t.Run(name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				listener := bufconn.Listen(1024 * 1024)
				t.Cleanup(func() { require.NoError(t, listener.Close()) })
				server := grpc.NewServer()
				t.Cleanup(server.Stop)
				application := &healthTestStorageServer{}
				resourcepb.RegisterResourceStoreServer(server, application)
				healthServer := health.NewServer()
				if !initiallyServing {
					healthServer.SetServingStatus("", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
				}
				grpc_health_v1.RegisterHealthServer(server, healthServer)
				go func() { _ = server.Serve(listener) }()

				opts := NewStorageOptions().buildGrpcDialOptions()
				opts = append(opts, grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
					return listener.DialContext(ctx)
				}))
				conn, err := grpc.NewClient("passthrough:///storage", opts...)
				require.NoError(t, err)
				t.Cleanup(func() { require.NoError(t, conn.Close()) })
				client := resourcepb.NewResourceStoreClient(conn)
				read := func() error {
					ctx, cancel := context.WithTimeout(t.Context(), time.Second)
					defer cancel()
					_, err := client.Read(ctx, &resourcepb.ReadRequest{}, grpc.WaitForReady(true))
					return err
				}

				if initiallyServing {
					require.NoError(t, read())
					healthServer.SetServingStatus("", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
					synctest.Wait()
				}

				before := application.calls.Load()
				assert.Equal(t, codes.DeadlineExceeded, status.Code(read()), "requests must wait while the endpoint is NOT_SERVING")
				require.Equal(t, before, application.calls.Load(), "an unhealthy endpoint must not receive application requests")

				healthServer.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)
				require.NoError(t, read())
				require.Equal(t, before+1, application.calls.Load(), "a recovered endpoint must receive requests again")
			})
		})
	}
}

type healthTestStorageServer struct {
	resourcepb.UnimplementedResourceStoreServer
	calls atomic.Int32
}

func (s *healthTestStorageServer) Read(context.Context, *resourcepb.ReadRequest) (*resourcepb.ReadResponse, error) {
	s.calls.Add(1)
	return &resourcepb.ReadResponse{}, nil
}

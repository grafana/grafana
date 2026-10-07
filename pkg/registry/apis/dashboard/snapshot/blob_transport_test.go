package snapshot

import (
	"context"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type snapshotBlobServer struct {
	resourcepb.UnimplementedBlobStoreServer
	value []byte
}

func (s *snapshotBlobServer) PutBlob(_ context.Context, req *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
	s.value = req.Value
	return &resourcepb.PutBlobResponse{Uid: "blob-1", Size: int64(len(s.value)), MimeType: "application/json"}, nil
}

func (s *snapshotBlobServer) GetBlob(context.Context, *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
	return &resourcepb.GetBlobResponse{Value: s.value, ContentType: "application/json"}, nil
}

func TestSnapshotBlobRemoteTransport(t *testing.T) {
	for _, tc := range []struct {
		name     string
		limit    int
		size     int
		wantCode codes.Code
	}{
		{name: "default limits support snapshots larger than 4 MiB", size: 5 << 20, wantCode: codes.OK},
		{name: "explicit receive limit is respected", limit: 4 << 20, size: 5 << 20, wantCode: codes.ResourceExhausted},
		{name: "higher receive limit supports snapshots larger than 32 MiB", limit: 64 << 20, size: 33 << 20, wantCode: codes.OK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			service, err := grpcserver.ProvideService(&setting.Cfg{GRPCServer: setting.GRPCServerSettings{MaxRecvMsgSize: tc.limit}}, nil, noop.NewTracerProvider().Tracer("test"), prometheus.NewRegistry())
			require.NoError(t, err)
			server := service.GetServer()
			resourcepb.RegisterBlobStoreServer(server, &snapshotBlobServer{})
			listener := bufconn.Listen(1 << 20)
			go func() { _ = server.Serve(listener) }()
			t.Cleanup(func() { server.Stop(); _ = listener.Close() })
			conn, err := grpc.NewClient("passthrough:///blobs", grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) {
				return listener.Dial()
			}))
			require.NoError(t, err)
			t.Cleanup(func() { _ = conn.Close() })
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			client := resourcepb.NewBlobStoreClient(conn)
			snap := newBlobTestSnapshot()
			snap.Spec.Dashboard["data"] = strings.Repeat("x", tc.size)
			original := snap.DeepCopy().Spec.Dashboard
			err = moveDashboardToBlob(ctx, client, snap)
			require.Equal(t, tc.wantCode, status.Code(err), "%v", err)
			if tc.wantCode != codes.OK {
				require.Equal(t, original, snap.Spec.Dashboard)
				require.Nil(t, snap.Blobs.Dashboard)
				return
			}
			require.Nil(t, snap.Spec.Dashboard)
			dashboard, found, err := readDashboardBlob(ctx, client, snap)
			require.NoError(t, err)
			require.True(t, found)
			require.Equal(t, original, dashboard)
		})
	}
}

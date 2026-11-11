package resource

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/grafana/dskit/middleware"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type nativeBlobErrorServer struct {
	resourcepb.UnimplementedBlobStoreStreamingServer
	failure *resourcepb.ErrorResult
}

func (s *nativeBlobErrorServer) PutBlobStream(stream resourcepb.BlobStoreStreaming_PutBlobStreamServer) error {
	if _, err := stream.Recv(); err != nil {
		return err
	}
	return GRPCStatusError(s.failure)
}

func (s *nativeBlobErrorServer) GetBlobStream(_ *resourcepb.GetBlobRequest, _ resourcepb.BlobStoreStreaming_GetBlobStreamServer) error {
	return GRPCStatusError(s.failure)
}

func TestBlobStreamNativeErrorsInProcess(t *testing.T) {
	failure := &resourcepb.ErrorResult{Code: http.StatusForbidden, Message: "denied"}
	channel := &inprocgrpc.Channel{}
	channel.RegisterService(&resourcepb.BlobStoreStreaming_ServiceDesc, &nativeBlobErrorServer{failure: failure})
	client := resourcepb.NewBlobStoreStreamingClient(channel)
	check := func(err error) {
		require.Equal(t, codes.PermissionDenied, status.Code(err))
		require.Equal(t, failure.Message, status.Convert(err).Message())
		details := status.Convert(err).Details()
		require.Len(t, details, 1)
		require.True(t, proto.Equal(failure, details[0].(*resourcepb.ErrorResult)))
	}
	put, err := client.PutBlobStream(t.Context())
	require.NoError(t, err)
	require.NoError(t, put.Send(&resourcepb.PutBlobRequest{}))
	putResp, err := put.CloseAndRecv()
	require.Nil(t, putResp)
	check(err)
	get, err := client.GetBlobStream(t.Context(), &resourcepb.GetBlobRequest{})
	require.NoError(t, err)
	getResp, err := get.Recv()
	require.Nil(t, getResp)
	check(err)
}

func TestUnaryRequestDurationInterceptor(t *testing.T) {
	tests := []struct {
		name string
		resp any
		err  error
		want codes.Code
	}{
		{"success", &resourcepb.ReadResponse{}, nil, codes.OK},
		{"nil response", nil, nil, codes.OK},
		{"typed nil response", (*resourcepb.ReadResponse)(nil), nil, codes.OK},
		{"not found", nil, GRPCStatusError(&resourcepb.ErrorResult{Code: http.StatusNotFound}), codes.NotFound},
		{"conflict", nil, GRPCStatusError(&resourcepb.ErrorResult{Code: http.StatusConflict, Reason: "Conflict"}), codes.Aborted},
		{"already exists", nil, GRPCStatusError(&resourcepb.ErrorResult{Code: http.StatusConflict}), codes.AlreadyExists},
		{"canceled", nil, status.Error(codes.Canceled, "canceled"), codes.Canceled},
		{"deadline exceeded", nil, status.Error(codes.DeadlineExceeded, "expired"), codes.DeadlineExceeded},
		{"transport error", nil, status.Error(codes.Unavailable, "unavailable"), codes.Unavailable},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewRegistry()
			metrics := ProvideStorageMetrics(reg)
			resp, err := UnaryRequestDurationInterceptor(metrics)(t.Context(), &resourcepb.ReadRequest{}, &grpc.UnaryServerInfo{FullMethod: "/resource.ResourceStore/Read"}, func(context.Context, any) (any, error) {
				return tt.resp, tt.err
			})
			require.Equal(t, tt.resp, resp)
			require.Equal(t, tt.err, err)
			families, gatherErr := reg.Gather()
			require.NoError(t, gatherErr)
			foundStatus := false
			foundListPath := false
			for _, family := range families {
				if family.GetName() != "grafana_storage_server_grpc_request_duration_seconds" {
					continue
				}
				require.Len(t, family.Metric, 1)
				require.Equal(t, uint64(1), family.Metric[0].GetHistogram().GetSampleCount())
				for _, label := range family.Metric[0].Label {
					switch label.GetName() {
					case "status_code":
						foundStatus = true
						require.Equal(t, tt.want.String(), label.GetValue())
					case "list_path":
						foundListPath = true
						require.Equal(t, listPathNotApplicable, label.GetValue())
					}
				}
			}
			require.True(t, foundStatus, "status_code metric label missing")
			require.True(t, foundListPath, "list_path metric label missing")
		})
	}
}

func TestUnaryRequestDurationInterceptorRecordsListPath(t *testing.T) {
	reg := prometheus.NewRegistry()
	metrics := ProvideStorageMetrics(reg)
	req := &resourcepb.ListRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
		Group: "dashboard.grafana.app", Resource: "dashboards",
	}}}

	_, err := UnaryRequestDurationInterceptor(metrics)(
		t.Context(),
		req,
		&grpc.UnaryServerInfo{FullMethod: "/resource.ResourceStore/List"},
		func(ctx context.Context, _ any) (any, error) {
			setListRequestPath(ctx, listPathTrash)
			return &resourcepb.ListResponse{}, nil
		},
	)
	require.NoError(t, err)

	families, err := reg.Gather()
	require.NoError(t, err)
	for _, family := range families {
		if family.GetName() != "grafana_storage_server_grpc_request_duration_seconds" {
			continue
		}
		require.Len(t, family.Metric, 1)
		for _, label := range family.Metric[0].Label {
			if label.GetName() == "list_path" {
				require.Equal(t, listPathTrash, label.GetValue())
				return
			}
		}
	}
	t.Fatal("list_path metric label missing")
}

type panickingResourceStore struct {
	resourcepb.UnimplementedResourceStoreServer
}

func (panickingResourceStore) Read(context.Context, *resourcepb.ReadRequest) (*resourcepb.ReadResponse, error) {
	panic("boom-unary")
}

func (panickingResourceStore) Watch(*resourcepb.WatchRequest, resourcepb.ResourceStore_WatchServer) error {
	panic("boom-stream")
}

func newRecoveryTestClient(t *testing.T) resourcepb.ResourceStoreClient {
	t.Helper()
	channel := &inprocgrpc.Channel{}
	desc := grpchan.InterceptServer(
		&resourcepb.ResourceStore_ServiceDesc,
		interceptors.UnaryPanicRecoveryInterceptor(),
		interceptors.StreamPanicRecoveryInterceptor(),
	)
	channel.RegisterService(desc, panickingResourceStore{})
	return resourcepb.NewResourceStoreClient(channel)
}

func TestPanicRecoveryInterceptor_Unary(t *testing.T) {
	client := newRecoveryTestClient(t)

	_, err := client.Read(t.Context(), &resourcepb.ReadRequest{})

	require.Error(t, err)
	require.Equal(t, codes.Internal, status.Code(err), "panic should surface as codes.Internal, got %v", err)
}

func TestPanicRecoveryInterceptor_Stream(t *testing.T) {
	client := newRecoveryTestClient(t)

	stream, err := client.Watch(t.Context(), &resourcepb.WatchRequest{})
	require.NoError(t, err, "opening the stream should succeed; the panic surfaces on Recv")

	_, err = stream.Recv()
	require.Error(t, err)
	require.Equal(t, codes.Internal, status.Code(err), "panic in stream handler should surface as codes.Internal, got %v", err)
}

// Watches expire on purpose, so the gRPC request metric must not count the
// expiry as an error the way it counts genuine failures.
func TestWatchExpiryIsNotAGRPCErrorInRequestMetrics(t *testing.T) {
	const route = "/resource.ResourceStore/Watch"
	hist := prometheus.NewHistogramVec(prometheus.HistogramOpts{Name: "grpc_request_duration_seconds"}, []string{"method", "route", "status_code", "ws"})
	instrument := middleware.StreamServerInstrumentInterceptor(hist)
	observed := func(statusCode string) uint64 {
		m := &dto.Metric{}
		require.NoError(t, hist.WithLabelValues("gRPC", route, statusCode, "false").(prometheus.Metric).Write(m))
		return m.GetHistogram().GetSampleCount()
	}

	srv := newWatchTestServer(t, watchTestServerOpts{NatsWatchMaxAge: 20 * time.Millisecond})
	req := &resourcepb.WatchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Group: watchTestGroup, Resource: watchTestResource}}}
	ctx, cancel := context.WithTimeout(authlib.WithAuthInfo(t.Context(), newWatchTestUser()), 5*time.Second)
	defer cancel()
	err := instrument(nil, newMockWatchServer(ctx), &grpc.StreamServerInfo{FullMethod: route}, func(_ any, ss grpc.ServerStream) error {
		return srv.Watch(req, ss.(resourcepb.ResourceStore_WatchServer))
	})
	require.True(t, IsResourceVersionExpired(err), "expected the max age to expire the watch, got %v", err)
	require.EqualValues(t, 1, observed("410"))
	require.Zero(t, observed("error"))

	err = instrument(nil, newMockWatchServer(ctx), &grpc.StreamServerInfo{FullMethod: route}, func(any, grpc.ServerStream) error {
		return status.Error(codes.Internal, "storage failed")
	})
	require.Error(t, err)
	require.EqualValues(t, 1, observed("error"), "genuine failures must still count as errors")
}

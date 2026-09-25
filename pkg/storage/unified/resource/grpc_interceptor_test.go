package resource

import (
	"context"
	"net/http"
	"testing"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestUnaryErrorResultInterceptor(t *testing.T) {
	failure := &resourcepb.ErrorResult{
		Code: http.StatusConflict, Reason: string(metav1.StatusReasonConflict), Message: "outdated version",
		Details: &resourcepb.ErrorDetails{Name: "dashboard", Causes: []*resourcepb.ErrorCause{{Field: "metadata.resourceVersion", Message: "outdated"}}},
	}
	transportErr := status.Error(codes.Unavailable, "transport failed")
	for _, tc := range []struct {
		name string
		resp any
		err  error
		want codes.Code
	}{
		{"embedded", &resourcepb.UpdateResponse{Error: failure}, nil, codes.Aborted},
		{"success", &resourcepb.ReadResponse{}, nil, codes.OK},
		{"typed nil", (*resourcepb.ReadResponse)(nil), nil, codes.OK},
		{"unrelated response", &resourcepb.HealthCheckResponse{}, nil, codes.OK},
		{"transport wins", &resourcepb.UpdateResponse{Error: failure}, transportErr, codes.Unavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resp, err := UnaryErrorResultInterceptor()(t.Context(), nil, &grpc.UnaryServerInfo{}, func(context.Context, any) (any, error) {
				return tc.resp, tc.err
			})
			require.Equal(t, tc.want, status.Code(err))
			if tc.name == "embedded" {
				require.Nil(t, resp)
				details := status.Convert(err).Details()
				require.Len(t, details, 1)
				require.True(t, proto.Equal(failure, details[0].(*resourcepb.ErrorResult)))
			} else {
				require.Equal(t, tc.resp, resp)
				require.Equal(t, tc.err, err)
			}
		})
	}
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
		{"unset error code", &resourcepb.ResourceSearchResponse{Error: &resourcepb.ErrorResult{}}, nil, codes.Internal},
		{"successful error code", &resourcepb.ReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusOK}}, nil, codes.Internal},
		{"reason with unset error code", &resourcepb.ReadResponse{Error: &resourcepb.ErrorResult{Reason: "NotFound"}}, nil, codes.NotFound},
		{"reason with successful error code", &resourcepb.UpdateResponse{Error: &resourcepb.ErrorResult{Code: http.StatusOK, Reason: "Conflict"}}, nil, codes.Aborted},
		{"vector search reason with unset error code", &resourcepb.VectorSearchResponse{Error: &resourcepb.ErrorResult{Reason: "NotFound"}}, nil, codes.NotFound},
		{"vector search reason with successful error code", &resourcepb.VectorSearchResponse{Error: &resourcepb.ErrorResult{Code: http.StatusOK, Reason: "Conflict"}}, nil, codes.Aborted},
		{"vector search unset error code", &resourcepb.VectorSearchResponse{Error: &resourcepb.ErrorResult{}}, nil, codes.Internal},
		{"vector search successful error code", &resourcepb.VectorSearchResponse{Error: &resourcepb.ErrorResult{Code: http.StatusOK}}, nil, codes.Internal},
		{"conflict", &resourcepb.UpdateResponse{Error: &resourcepb.ErrorResult{Code: http.StatusConflict, Reason: "Conflict"}}, nil, codes.Aborted},
		{"already exists", &resourcepb.CreateResponse{Error: &resourcepb.ErrorResult{Code: http.StatusConflict}}, nil, codes.AlreadyExists},
		{"transport error", nil, status.Error(codes.Unavailable, "unavailable"), codes.Unavailable},
		{"transport error takes precedence", &resourcepb.ReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusNotFound}}, status.Error(codes.Unavailable, "unavailable"), codes.Unavailable},
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
			found := false
			for _, family := range families {
				if family.GetName() != "storage_server_grpc_request_duration_seconds" {
					continue
				}
				require.Len(t, family.Metric, 1)
				require.Equal(t, uint64(1), family.Metric[0].GetHistogram().GetSampleCount())
				for _, label := range family.Metric[0].Label {
					if label.GetName() == "status_code" {
						found = true
						require.Equal(t, tt.want.String(), label.GetValue())
					}
				}
			}
			require.True(t, found, "status_code metric label missing")
		})
	}
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

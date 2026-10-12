package resource

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resourceclient"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type retryTestResourceServer struct {
	ResourceServer
	failure  error
	attempts int
}

func (s *retryTestResourceServer) Update(context.Context, *resourcepb.UpdateRequest) (*resourcepb.UpdateResponse, error) {
	s.attempts++
	if s.attempts == 1 {
		return nil, s.failure
	}
	return &resourcepb.UpdateResponse{}, nil
}

func TestLocalResourceClientRetryCodes(t *testing.T) {
	for _, code := range []codes.Code{codes.Aborted, codes.Unavailable, codes.ResourceExhausted, codes.InvalidArgument} {
		t.Run(code.String(), func(t *testing.T) {
			st, err := status.New(code, "failure").WithDetails(&resourcepb.ErrorResult{Code: http.StatusConflict, Message: "conflict"})
			require.NoError(t, err)
			srv := &retryTestResourceServer{failure: st.Err()}
			client := NewLocalResourceClient(srv)
			ctx, _ := identity.WithServiceIdentity(t.Context(), 1)
			_, err = client.Update(ctx, &resourcepb.UpdateRequest{})
			if code == codes.Unavailable || code == codes.ResourceExhausted {
				require.NoError(t, err)
				require.Equal(t, 2, srv.attempts)
			} else {
				require.Equal(t, 1, srv.attempts)
				require.Equal(t, st.Proto(), status.Convert(err).Proto())
			}
		})
	}
}

type missingReadBackend struct{ mockStorageBackend }

func (*missingReadBackend) ReadResource(context.Context, *resourcepb.ReadRequest) *BackendReadResponse {
	return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusNotFound, Message: "missing"}}
}

func TestLocalResourceClientErrorConversion(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("enabled=%t", enabled), func(t *testing.T) {
			srv, err := NewResourceServer(ResourceServerOptions{
				Backend: &missingReadBackend{}, GRPCErrorResultToStatus: enabled,
			})
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, srv.Stop(context.Background())) })
			client := NewLocalResourceClient(srv)
			ctx, _ := identity.WithServiceIdentity(t.Context(), 1)
			resp, err := client.Read(ctx, &resourcepb.ReadRequest{Key: &resourcepb.ResourceKey{
				Namespace: "default", Group: "example.grafana.app", Resource: "widgets", Name: "missing",
			}})
			if !enabled {
				require.NoError(t, err)
				require.Equal(t, int32(http.StatusNotFound), resp.GetError().GetCode())
				return
			}
			require.Equal(t, codes.NotFound, status.Code(err))
			details := status.Convert(err).Details()
			require.Len(t, details, 1)
			require.Equal(t, int32(http.StatusNotFound), details[0].(*resourcepb.ErrorResult).Code)
		})
	}
}

func TestResourceClientFlagNamesMatchFeatureToggles(t *testing.T) {
	require.Equal(t, featuremgmt.FlagUnifiedStorageClientRequireCallerIdentity, resourceclient.FlagUnifiedStorageClientRequireCallerIdentity)
	require.Equal(t, featuremgmt.FlagUnifiedStorageClientOnBehalfOf, resourceclient.FlagUnifiedStorageClientOnBehalfOf)
}

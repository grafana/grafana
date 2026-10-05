package federated

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestFederatedGetStatsErrors(t *testing.T) {
	result := &resourcepb.ErrorResult{Code: 404, Reason: "NotFound", Message: "folder not found"}
	st, err := status.New(codes.NotFound, result.Message).WithDetails(result)
	require.NoError(t, err)
	for _, encoding := range []string{"embedded", "grpc"} {
		t.Run(encoding, func(t *testing.T) {
			response, err := &resourcepb.ResourceStatsResponse{Error: result}, error(nil)
			if encoding == "grpc" {
				response, err = nil, st.Err()
			}
			base := resource.NewMockResourceClient(t)
			in := &resourcepb.ResourceStatsRequest{Namespace: "default", Folder: []string{"missing"}}
			base.On("GetStats", mock.Anything, in).Return(response, err).Once()
			client := NewFederatedClient(base, func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
				t.Fatal("SQL must not be called after a storage error")
				return nil, nil
			}, nil)

			response, err = client.GetStats(context.Background(), in)
			require.Error(t, err)
			require.Nil(t, response)
			require.Equal(t, result.Code, resource.AsErrorResult(err).Code)
			require.Equal(t, result.Message, resource.AsErrorResult(err).Message)
		})
	}
}

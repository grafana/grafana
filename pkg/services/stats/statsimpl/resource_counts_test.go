package statsimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestGetResourceCountsErrors(t *testing.T) {
	result := &resourcepb.ErrorResult{Code: 404, Reason: "NotFound", Message: "namespace not found"}
	st, err := status.New(codes.NotFound, result.Message).WithDetails(result)
	require.NoError(t, err)
	for _, tc := range []struct {
		name     string
		response *resourcepb.ResourceStatsResponse
		err      error
	}{
		{name: "grpc", err: st.Err()},
		{name: "wrapped grpc", err: fmt.Errorf("get stats: %w", st.Err())},
		{name: "grpc with partial response", response: &resourcepb.ResourceStatsResponse{
			Stats: []*resourcepb.ResourceStatsResponse_Stats{{Count: 7}},
		}, err: st.Err()},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := resource.NewMockResourceClient(t)
			client.On("GetStats", mock.Anything, mock.Anything).Return(&resourcepb.ResourceStatsResponse{
				Stats: []*resourcepb.ResourceStatsResponse_Stats{{Count: 5}},
			}, nil).Once()
			client.On("GetStats", mock.Anything, mock.Anything).Return(tc.response, tc.err).Once()
			service := &sqlStatsService{unifiedStorage: client, namespacer: func(int64) string { return "default" }}

			counts, err := service.getResourceCounts(context.Background(), []*org.OrgDTO{{ID: 1}, {ID: 2}, {ID: 3}}, []string{"folder.grafana.app/folders"})
			require.Error(t, err)
			require.Nil(t, counts)
			require.ErrorIs(t, err, st.Err())
			require.Equal(t, result.Code, resource.AsErrorResult(err).Code)
			require.Equal(t, result.Message, resource.AsErrorResult(err).Message)
		})
	}
}

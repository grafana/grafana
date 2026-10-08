package legacy

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestPreferencesCountValidatorStats(t *testing.T) {
	gr := schema.GroupResource{Group: "preferences.grafana.app", Resource: "preferences"}
	result := resource.NewBadRequestError("stats unavailable for kind")
	structured, err := status.New(codes.InvalidArgument, result.Message).WithDetails(result)
	require.NoError(t, err)

	for _, tt := range []struct {
		name string
		resp *resourcepb.ResourceStatsResponse
		err  error
	}{
		{name: "embedded error", resp: &resourcepb.ResourceStatsResponse{Error: result}},
		{name: "grpc error", err: structured.Err()},
	} {
		t.Run(tt.name, func(t *testing.T) {
			client := resource.NewMockResourceClient(t)
			client.On("GetStats", mock.Anything, &resourcepb.ResourceStatsRequest{Namespace: "default", Kinds: []string{gr.Group + "/" + gr.Resource}}).
				Return(tt.resp, tt.err).Once()
			v := &preferencesCountValidator{client: client, resource: gr, driverName: migrator.MySQL}
			_, err := v.countUnified(t.Context(), nil, &resourcepb.BulkResponse_Summary{Namespace: "default", Group: gr.Group, Resource: gr.Resource})
			require.Error(t, err)
			require.True(t, proto.Equal(result, resource.AsErrorResult(err)))
		})
	}
}

package migrations

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func TestCountValidatorStats(t *testing.T) {
	gr := schema.GroupResource{Group: "test.grafana.app", Resource: "items"}
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
			eng, err := xorm.NewEngine("sqlite3", ":memory:")
			require.NoError(t, err)
			t.Cleanup(func() { _ = eng.Close() })
			_, err = eng.Exec("CREATE TABLE legacy_items (org_id INTEGER)")
			require.NoError(t, err)

			client := resource.NewMockResourceClient(t)
			client.On("GetStats", mock.Anything, &resourcepb.ResourceStatsRequest{Namespace: "default", Kinds: []string{gr.Group + "/" + gr.Resource}}).
				Return(tt.resp, tt.err).Once()
			v := newCountValidator(client, gr, CountValidationOptions{Table: "legacy_items", Where: "org_id = ?"}, migrator.MySQL)
			sess := eng.NewSession()
			defer sess.Close()
			err = v.Validate(t.Context(), sess, &resourcepb.BulkResponse{
				Summary: []*resourcepb.BulkResponse_Summary{{Namespace: "default", Group: gr.Group, Resource: gr.Resource}},
			}, log.NewNopLogger())
			require.ErrorContains(t, err, "failed to get stats for test.grafana.app/items in namespace default")
			require.True(t, proto.Equal(result, resource.AsErrorResult(err)))
		})
	}
}

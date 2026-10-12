package migrator

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func TestDataSourceCountValidatorStats(t *testing.T) {
	const group = "prometheus.datasource.grafana.app"
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
			_, err = eng.Exec("CREATE TABLE data_source (org_id INTEGER)")
			require.NoError(t, err)

			client := resource.NewMockResourceClient(t)
			client.On("GetStats", mock.Anything, &resourcepb.ResourceStatsRequest{Namespace: "default", Kinds: []string{group + "/datasources"}}).
				Return(tt.resp, tt.err).Once()
			v := &DataSourceCountValidator{client: client, driverName: migrator.MySQL}
			sess := eng.NewSession()
			defer sess.Close()
			err = v.Validate(t.Context(), sess, &resourcepb.BulkResponse{
				Summary: []*resourcepb.BulkResponse_Summary{{Namespace: "default", Group: group, Resource: "datasources"}},
			}, log.NewNopLogger())
			require.ErrorContains(t, err, "failed to get stats for prometheus.datasource.grafana.app/datasources")
			require.True(t, proto.Equal(result, resource.AsErrorResult(err)))
		})
	}
}

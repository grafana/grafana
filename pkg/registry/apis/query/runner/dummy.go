package runner

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkapi "github.com/grafana/grafana-plugin-sdk-go/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	testdata "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

type testdataDummy struct{}

var _ query.QueryRunner = (*testdataDummy)(nil)
var _ query.DataSourceApiServerRegistry = (*testdataDummy)(nil)

// NewDummyTestRunner creates a runner that only works with testdata
func NewDummyTestRunner() query.QueryRunner {
	return &testdataDummy{}
}

func NewDummyRegistry() query.DataSourceApiServerRegistry {
	return &testdataDummy{}
}

// ExecuteQueryData implements QueryHelper.
func (d *testdataDummy) ExecuteQueryData(ctx context.Context,
	// The k8s group for the datasource (pluginId)
	datasource schema.GroupVersion,

	// The datasource name/uid
	name string,

	// The raw backend query objects
	request sdkapi.DataQueryRequest,
) (*backend.QueryDataResponse, error) {
	if datasource.Group != "testdata.datasource.grafana.app" {
		return nil, fmt.Errorf("expecting testdata requests")
	}

	queries, _, err := legacydata.ToDataSourceQueries(request)
	if err != nil {
		return nil, err
	}

	return testdata.ProvideService().QueryData(ctx, &backend.QueryDataRequest{
		Queries: queries,
	})
}

// GetDatasourceAPI implements DataSourceRegistry.
func (*testdataDummy) GetDatasourceGroupVersion(pluginId string) (schema.GroupVersion, error) {
	if pluginId == "testdata" || pluginId == "grafana-testdata-datasource" {
		return schema.GroupVersion{
			Group:   "testdata.datasource.grafana.app",
			Version: "v0alpha1",
		}, nil
	}
	return schema.GroupVersion{}, fmt.Errorf("unsupported plugin (only testdata for now)")
}

// GetDatasourcePlugins implements QueryHelper.
func (d *testdataDummy) GetDatasourceApiServers(ctx context.Context) (*query.DataSourceApiServerList, error) {
	return &query.DataSourceApiServerList{
		ListMeta: metav1.ListMeta{
			ResourceVersion: fmt.Sprintf("%d", time.Now().UnixMilli()),
		},
		Items: []query.DataSourceApiServer{
			{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "grafana-testdata-datasource",
					CreationTimestamp: metav1.Now(),
				},
				Title:        "Test Data",
				GroupVersion: "testdata.datasource.grafana.app/v0alpha1",
				AliasIDs:     []string{"testdata"},
			},
		},
	}, nil
}

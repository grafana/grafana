package runner

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	testdata "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

type testdataDummy struct{}

var _ v0alpha1.QueryRunner = (*testdataDummy)(nil)
var _ v0alpha1.DataSourceApiServerRegistry = (*testdataDummy)(nil)

// NewDummyTestRunner creates a runner that only works with testdata
func NewDummyTestRunner() v0alpha1.QueryRunner {
	return &testdataDummy{}
}

func NewDummyRegistry() v0alpha1.DataSourceApiServerRegistry {
	return &testdataDummy{}
}

// ExecuteQueryData implements QueryHelper.
func (d *testdataDummy) ExecuteQueryData(ctx context.Context,
	// The k8s group for the datasource (pluginId)
	datasource schema.GroupVersion,

	// The datasource name/uid
	name string,

	// The raw backend query objects
	query []resource.GenericDataQuery,
) (*backend.QueryDataResponse, error) {
	if datasource.Group != "testdata.datasource.grafana.app" {
		return nil, fmt.Errorf("expecting testdata requests")
	}

	queries, _, err := legacydata.ToDataSourceQueries(v0alpha1.GenericQueryRequest{
		Queries: query,
	})
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
func (d *testdataDummy) GetDatasourceApiServers(ctx context.Context) (*v0alpha1.DataSourceApiServerList, error) {
	return &v0alpha1.DataSourceApiServerList{
		ListMeta: metav1.ListMeta{
			ResourceVersion: fmt.Sprintf("%d", time.Now().UnixMilli()),
		},
		Items: []v0alpha1.DataSourceApiServer{
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

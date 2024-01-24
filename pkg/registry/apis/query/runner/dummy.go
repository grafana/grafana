package runner

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	testdata "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
)

type testdataDummy struct{}

var _ QueryRunner = (*testdataDummy)(nil)
var _ DataSourceRegistry = (*testdataDummy)(nil)

// NewDummyTestRunner creates a runner that only works with testdata
func NewDummyTestRunner() QueryRunner {
	return &testdataDummy{}
}

func NewDummyRegistry() DataSourceRegistry {
	return &testdataDummy{}
}

// ExecuteQueryData implements QueryHelper.
func (d *testdataDummy) ExecuteQueryData(ctx context.Context,
	// The k8s group for the datasource (pluginId)
	datasource schema.GroupVersion,

	// The datasource name/uid
	name string,

	// The raw backend query objects
	query []backend.DataQuery,
) (*backend.QueryDataResponse, error) {
	if datasource.Group != "testdata.datasource.grafana.app" {
		return nil, fmt.Errorf("expecting testdata requests")
	}
	return testdata.ProvideService().QueryData(ctx, &backend.QueryDataRequest{
		Queries: query,
	})
}

// GetDatasourceAPI implements DataSourceRegistry.
func (*testdataDummy) GetDatasourceAPI(pluginId string) (schema.GroupVersion, error) {
	if pluginId == "testdata" || pluginId == "grafana-testdata-datasource" {
		return schema.GroupVersion{
			Group:   "testdata.datasource.grafana.app",
			Version: "v0alpha1",
		}, nil
	}
	return schema.GroupVersion{}, fmt.Errorf("unsupported plugin (only testdata for now)")
}

// GetDataSources implements QueryHelper.
func (d *testdataDummy) GetDataSources(ctx context.Context, namespace string, options *internalversion.ListOptions) (*v0alpha1.DataSourceList, error) {
	return &v0alpha1.DataSourceList{
		ListMeta: metav1.ListMeta{
			ResourceVersion: fmt.Sprintf("%d", time.Now().UnixMilli()),
		},
		Items: []v0alpha1.DataSource{
			{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "PD8C576611E62080A",
					CreationTimestamp: metav1.Now(),
				},
				Title: "gdev-testdata",
				Group: "testdata.datasource.grafana.app",
				Health: &v0alpha1.HealthCheck{
					Status:  "OK",
					Checked: time.Now().UnixMilli(),
				},
			},
		},
	}, nil
}

// GetDatasourcePlugins implements QueryHelper.
func (d *testdataDummy) GetDatasourcePlugins(ctx context.Context, options *internalversion.ListOptions) (*v0alpha1.DataSourcePluginList, error) {
	return &v0alpha1.DataSourcePluginList{
		ListMeta: metav1.ListMeta{
			ResourceVersion: fmt.Sprintf("%d", time.Now().UnixMilli()),
		},
		Items: []v0alpha1.DataSourcePlugin{
			{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "grafana-testdata-datasource",
					CreationTimestamp: metav1.Now(),
				},
				Title:        "Test Data",
				GroupVersion: "testdata.datasource.grafana.app/v0alpha1",
				PluginID:     "grafana-testdata-datasource",
				AliasIDs:     []string{"testdata"},
				Capabilities: []string{"QueryData"},
				IconURL:      "https://grafana.com/api/plugins/grafana-testdata-datasource/versions/10.3.0-pre-6b4337a/logos/large",
			},
		},
	}, nil
}

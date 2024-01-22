package query

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	testdata "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
)

type QueryRunner interface {
	// Runs the query as the user in context
	ExecuteQueryData(ctx context.Context,
		// The k8s group for the datasource (pluginId)
		group string,

		// The group version (eg v0alpha1)
		apiVersion string,

		// The datasource name/uid
		name string,

		// The raw backend query objects
		query []backend.DataQuery,
	) (*backend.QueryDataResponse, error)

	// Get the list of available datasource plugins
	// The values will be managed though API discovery/reconciliation
	GetDatasourcePlugins(ctx context.Context) (*v0alpha1.DataSourcePluginList, error)

	// Get the list of all datasource instances (across all plugins)
	// The values will be managed though API discovery/reconciliation
	GetDataSources(ctx context.Context, namespace string) (*v0alpha1.DataSourceList, error)
}

var _ QueryRunner = (*dummyTestDataRunner)(nil)

type dummyTestDataRunner struct{}

// ExecuteQueryData implements QueryHelper.
func (d *dummyTestDataRunner) ExecuteQueryData(ctx context.Context,
	// The k8s group for the datasource (pluginId)
	group string,

	// The group version (eg v0alpha1)
	apiVersion string,

	// The datasource name/uid
	name string,

	// The raw backend query objects
	query []backend.DataQuery,
) (*backend.QueryDataResponse, error) {
	return testdata.ProvideService().QueryData(ctx, &backend.QueryDataRequest{
		Queries: query,
	})
}

// GetDataSources implements QueryHelper.
func (d *dummyTestDataRunner) GetDataSources(ctx context.Context, namespace string) (*v0alpha1.DataSourceList, error) {
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
				Title:    "gdev-testdata",
				PluginID: "grafana-testdata-datasource",
				Health: &v0alpha1.HealthCheck{
					Status:  "OK",
					Checked: time.Now().UnixMilli(),
				},
			},
		},
	}, nil
}

// GetDatasourcePlugins implements QueryHelper.
func (d *dummyTestDataRunner) GetDatasourcePlugins(ctx context.Context) (*v0alpha1.DataSourcePluginList, error) {
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
				GroupVersion: "testdata.datasource.grafana.app",
				Capabilities: []string{"..."},
				IconURL:      "https://grafana.com/api/plugins/grafana-testdata-datasource/versions/10.3.0-pre-6b4337a/logos/large",
			},
		},
	}, nil
}

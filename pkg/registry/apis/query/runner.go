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

type QueryHelper interface {
	// Runs the query as the user in context
	ExecuteQueryData(ctx context.Context, query *backend.QueryDataRequest) (*backend.QueryDataResponse, error)

	// Get all plugins (with elevated permissions)
	GetDatasourcePlugins(ctx context.Context) (*v0alpha1.DataSourcePluginList, error)

	// List all datasources (with elevated permissions)
	GetDataSources(ctx context.Context, orgId int64) (*v0alpha1.DataSourceList, error)
}

var _ QueryHelper = (*dummyTestDataRunner)(nil)

type dummyTestDataRunner struct{}

// ExecuteQueryData implements QueryHelper.
func (d *dummyTestDataRunner) ExecuteQueryData(ctx context.Context, query *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if query.PluginContext.DataSourceInstanceSettings == nil {
		return nil, fmt.Errorf("type should be set in the instance settings")
	}
	if query.PluginContext.DataSourceInstanceSettings.Type != "grafana-testdata-datasource" {
		return nil, fmt.Errorf("only testdata supported here")
	}
	return testdata.ProvideService().QueryData(ctx, query)
}

// GetDataSources implements QueryHelper.
func (d *dummyTestDataRunner) GetDataSources(ctx context.Context, orgId int64) (*v0alpha1.DataSourceList, error) {
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

package client

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	testdata "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

type testdataDummy struct{}

var _ data.QueryDataClient = (*testdataDummy)(nil)
var _ query.DataSourceApiServerRegistry = (*testdataDummy)(nil)

// NewTestDataClient creates a runner that only works with testdata
func NewTestDataClient() data.QueryDataClient {
	return &testdataDummy{}
}

// NewTestDataRegistry returns a registry that only knows about testdata
func NewTestDataRegistry() query.DataSourceApiServerRegistry {
	return &testdataDummy{}
}

// ExecuteQueryData implements QueryHelper.
func (d *testdataDummy) QueryData(ctx context.Context, req data.QueryDataRequest) (int, *backend.QueryDataResponse, error) {
	queries, _, err := legacydata.ToDataSourceQueries(req)
	if err != nil {
		return http.StatusBadRequest, nil, err
	}

	qdr := &backend.QueryDataRequest{Queries: queries}
	rsp, err := testdata.ProvideService().QueryData(ctx, qdr)
	return query.GetResponseCode(rsp), rsp, err
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

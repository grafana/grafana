package client

import (
	"context"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

type testdataDummy struct{}

var _ query.DataSourceApiServerRegistry = (*testdataDummy)(nil)

// NewTestDataRegistry returns a registry that only knows about testdata
func NewTestDataRegistry() query.DataSourceApiServerRegistry {
	return &testdataDummy{}
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

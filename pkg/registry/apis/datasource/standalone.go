package datasource

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
	testdatasource "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
)

// NewStandaloneDatasource is a helper function to create a new datasource API server for a group.
// This currently has no dependencies and only works for testdata.  In future iterations
// this will include here (or elsewhere) versions that can load config from HG api or
// the remote SQL directly.
func NewStandaloneDatasource(group string) (*DataSourceAPIBuilder, error) {
	pluginID := "grafana-testdata-datasource"

	if group != "testdata.datasource.grafana.app" {
		return nil, fmt.Errorf("only %s is currently supported", pluginID)
	}

	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
		// TODO: Add support for args?
	})
	if err != nil {
		return nil, err
	}

	f, err := os.Open(filepath.Join(cfg.StaticRootPath, "app/plugins/datasource", pluginID, "plugin.json"))
	if err != nil {
		return nil, err
	}

	pluginJSON, err := plugins.ReadPluginJSON(f)
	if err != nil {
		return nil, err
	}
	err = f.Close()
	if err != nil {
		return nil, err
	}

	var testsDataQuerierFactory QuerierFactoryFunc = func(ri common.ResourceInfo, pj plugins.JSONData) (Querier, error) {
		return NewTestDataQuerier(pluginJSON, testdatasource.ProvideService())
	}

	return NewDataSourceAPIBuilder(
		pluginJSON,
		NewQuerierProvider(testsDataQuerierFactory),
		&TestDataPluginContextProvider{},
		acimpl.ProvideAccessControl(cfg),
	)
}

type TestDataPluginContextProvider struct{}

func (p *TestDataPluginContextProvider) PluginContextForDataSource(_ context.Context, _, _ string) (backend.PluginContext, error) {
	return backend.PluginContext{}, nil
}

type TestDataQuerier struct {
	ri         common.ResourceInfo
	pluginJSON plugins.JSONData
	testdata   *testdatasource.Service
}

func NewTestDataQuerier(pluginJSON plugins.JSONData, testdata *testdatasource.Service) (*TestDataQuerier, error) {
	ri, err := resourceFromPluginID(pluginJSON.ID)
	if err != nil {
		return nil, err
	}

	return &TestDataQuerier{
		ri:         ri,
		pluginJSON: pluginJSON,
		testdata:   testdata,
	}, nil
}

func (q *TestDataQuerier) Query(ctx context.Context, query *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return q.testdata.QueryData(ctx, query)
}

func (q *TestDataQuerier) Resource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return q.testdata.CallResource(ctx, req, sender)
}

func (q *TestDataQuerier) Health(ctx context.Context, query *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return q.testdata.CheckHealth(ctx, query)
}

func (q *TestDataQuerier) Datasource(ctx context.Context, name string) (*v0alpha1.DataSourceConnection, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	dss := staticDataSources(q.pluginJSON.ID)
	for _, ds := range dss {
		if ds.UID == name {
			return asConnection(q.ri.TypeMeta(), ds, info.Value)
		}
	}
	return nil, fmt.Errorf("testdata datasource %s not found", name)
}

func (q *TestDataQuerier) Datasources(ctx context.Context) (*v0alpha1.DataSourceConnectionList, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	dss := staticDataSources(q.pluginJSON.ID)
	return asConnectionList(q.ri.TypeMeta(), dss, info.Value)
}

func staticDataSources(pluginID string) []*datasources.DataSource {
	now := time.Now()
	return []*datasources.DataSource{
		{
			OrgID:   int64(1), // default -- used in the list command
			Type:    pluginID,
			UID:     "builtin", // fake for now
			Created: now,
			Updated: now,
			Name:    "Testdata (builtin)",
		},
		{
			OrgID:   int64(1), // default -- used in the list command
			Type:    pluginID,
			UID:     "PD8C576611E62080A", // match the gdev version
			Created: now,
			Updated: now,
			Name:    "gdev-testdata",
		},
	}
}

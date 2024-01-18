package datasource

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
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

	_, pluginStore, dsService, dsCache, err := apiBuilderServices(cfg, pluginID)
	if err != nil {
		return nil, err
	}

	td, exists := pluginStore.Plugin(context.Background(), pluginID)
	if !exists {
		return nil, fmt.Errorf("plugin %s not found", pluginID)
	}

	var testsDataQuerierFactory QuerierFactoryFunc = func(ctx context.Context, ri common.ResourceInfo, pj plugins.JSONData) (Querier, error) {
		return NewDefaultQuerier(ri, td.JSONData, testdatasource.ProvideService(), dsService, dsCache), nil
	}

	return NewDataSourceAPIBuilder(
		td.JSONData,
		NewQuerierProvider(testsDataQuerierFactory),
		&TestDataPluginContextProvider{},
		acimpl.ProvideAccessControl(cfg),
	)
}

type TestDataPluginContextProvider struct{}

func (p *TestDataPluginContextProvider) PluginContextForDataSource(_ context.Context, _, _ string) (backend.PluginContext, error) {
	return backend.PluginContext{}, nil
}

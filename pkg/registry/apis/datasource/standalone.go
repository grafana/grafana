package datasource

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
	testdatasource "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
)

// This is a helper function to create a new datasource API server for a group
// This currently has no dependencies and only works for testdata.  In future iterations
// this will include here (or elsewhere) versions that can load config from HG api or
// the remote SQL directly
func NewStandaloneDatasource(group string) (*DataSourceAPIBuilder, error) {
	if group != "testdata.datasource.grafana.app" {
		return nil, fmt.Errorf("only testadata is currently supported")
	}
	pluginId := "grafana-testdata-datasource"

	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
		// TODO: Add support for args?
	})
	if err != nil {
		return nil, err
	}

	accessControl, pluginstoreService, dsService, cacheServiceImpl, err := apiBuilderServices(cfg, pluginId)
	if err != nil {
		return nil, err
	}

	testdataPlugin, found := pluginstoreService.Plugin(context.Background(), pluginId)
	if !found {
		return nil, fmt.Errorf("plugin %s not found", pluginId)
	}

	return NewDataSourceAPIBuilder(
		testdataPlugin.JSONData,
		testdatasource.ProvideService(),
		dsService,
		cacheServiceImpl,
		accessControl,
	)
}

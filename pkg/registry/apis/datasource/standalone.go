package datasource

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
	testdatasource "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
)

// NewTestDataAPIServer is a helper function to create a new datasource API server for a group.
// This currently builds its dependencies manually and only works for testdata.
func NewTestDataAPIServer(group string) (*DataSourceAPIBuilder, error) {
	pluginID := "grafana-testdata-datasource"
	features := featuremgmt.WithFeatures() // None for now!

	if group != "testdata.datasource.grafana.app" {
		return nil, fmt.Errorf("only %s is currently supported", pluginID)
	}

	// Run standalone with zero dependencies
	if true {
		return NewDataSourceAPIBuilder(
			plugins.JSONData{
				ID: pluginID,
			},
			testdatasource.ProvideService(), // the client
			&pluginDatasourceImpl{
				startup: v1.Now(),
			},
			&pluginDatasourceImpl{}, // stub
			&actest.FakeAccessControl{ExpectedEvaluate: true},
		)
	}

	// Otherwise manually wire up access to testdata
	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
		// TODO: Add support for args?
	})
	if err != nil {
		return nil, err
	}

	accessControl, pluginStore, dsService, dsCache, err := apiBuilderServices(cfg, features, pluginID)
	if err != nil {
		return nil, err
	}

	td, exists := pluginStore.Plugin(context.Background(), pluginID)
	if !exists {
		return nil, fmt.Errorf("plugin %s not found", pluginID)
	}

	return NewDataSourceAPIBuilder(
		td.JSONData,
		testdatasource.ProvideService(), // the client
		&defaultPluginDatasourceProvider{
			dsService: dsService,
			dsCache:   dsCache,
		},
		&pluginDatasourceImpl{}, // stub
		accessControl,
	)
}

// Simple stub for standalone testing
type pluginDatasourceImpl struct {
	startup v1.Time
}

var (
	_ PluginDatasourceProvider = (*pluginDatasourceImpl)(nil)
)

// Get implements PluginDatasourceProvider.
func (p *pluginDatasourceImpl) Get(ctx context.Context, pluginID string, uid string) (*v0alpha1.DataSourceConnection, error) {
	all, err := p.List(ctx, pluginID)
	if err != nil {
		return nil, err
	}
	for idx, v := range all.Items {
		if v.Name == uid {
			return &all.Items[idx], nil
		}
	}
	return nil, fmt.Errorf("not found")
}

// List implements PluginConfigProvider.
func (p *pluginDatasourceImpl) List(ctx context.Context, pluginID string) (*v0alpha1.DataSourceConnectionList, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	return &v0alpha1.DataSourceConnectionList{
		TypeMeta: v0alpha1.GenericConnectionResourceInfo.TypeMeta(),
		Items: []v0alpha1.DataSourceConnection{
			{
				ObjectMeta: v1.ObjectMeta{
					Name:              "PD8C576611E62080A",
					Namespace:         info.Value, // the raw namespace value
					CreationTimestamp: p.startup,
				},
				Title: "gdev-testdata",
			},
		},
	}, nil
}

// PluginContextForDataSource implements PluginConfigProvider.
func (*pluginDatasourceImpl) GetInstanceSettings(ctx context.Context, pluginID, uid string) (*backend.DataSourceInstanceSettings, error) {
	return &backend.DataSourceInstanceSettings{}, nil
}

// PluginContextWrapper
func (*pluginDatasourceImpl) PluginContextForDataSource(ctx context.Context, datasourceSettings *backend.DataSourceInstanceSettings) (backend.PluginContext, error) {
	return backend.PluginContext{DataSourceInstanceSettings: datasourceSettings}, nil
}

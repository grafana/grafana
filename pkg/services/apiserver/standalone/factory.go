package standalone

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/web"
	"github.com/prometheus/client_golang/prometheus"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"

	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/registry/apis/query"
	"github.com/grafana/grafana/pkg/registry/apis/query/client"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	testdatasource "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
)

type APIServerFactory interface {
	// Called before the groups are loaded so any custom command can be registered
	GetOptions() options.OptionsProvider

	// Given the flags, what can we produce
	GetEnabled(runtime []RuntimeConfig) ([]schema.GroupVersion, error)

	// Any optional middlewares this factory wants configured via apiserver's BuildHandlerChain facility
	GetOptionalMiddlewares(tracer tracing.Tracer) []web.Middleware

	// Make an API server for a given group+version
	MakeAPIServer(ctx context.Context, tracer tracing.Tracer, gv schema.GroupVersion) (builder.APIGroupBuilder, error)

	Shutdown()
}

// Zero dependency provider for testing
func GetDummyAPIFactory() APIServerFactory {
	return &DummyAPIFactory{}
}

type DummyAPIFactory struct{}

func (p *DummyAPIFactory) GetOptions() options.OptionsProvider {
	return nil
}

func (p *DummyAPIFactory) GetOptionalMiddlewares(_ tracing.Tracer) []web.Middleware {
	return []web.Middleware{}
}

func (p *DummyAPIFactory) GetEnabled(runtime []RuntimeConfig) ([]schema.GroupVersion, error) {
	gv := []schema.GroupVersion{}
	for _, cfg := range runtime {
		if !cfg.Enabled {
			return nil, fmt.Errorf("only enabled supported now")
		}
		if cfg.Group == "all" {
			return nil, fmt.Errorf("all not yet supported")
		}
		gv = append(gv, schema.GroupVersion{Group: cfg.Group, Version: cfg.Version})
	}
	return gv, nil
}

func (p *DummyAPIFactory) ApplyTo(config *genericapiserver.RecommendedConfig) error {
	return nil
}

func (p *DummyAPIFactory) MakeAPIServer(_ context.Context, tracer tracing.Tracer, gv schema.GroupVersion) (builder.APIGroupBuilder, error) {
	if gv.Version != "v0alpha1" {
		return nil, fmt.Errorf("only alpha supported now")
	}

	switch gv.Group {
	// Only works with testdata
	case "query.grafana.app":
		return query.NewQueryAPIBuilder(
			featuremgmt.WithFeatures(),
			&query.CommonDataSourceClientSupplier{
				Client: client.NewTestDataClient(),
			},
			client.NewTestDataRegistry(),
			nil,                      // legacy lookup
			prometheus.NewRegistry(), // ???
			tracer,
		)

	case "testdata.datasource.grafana.app":
		return datasource.NewDataSourceAPIBuilder(
			plugins.JSONData{
				ID: "grafana-testdata-datasource",
			},
			testdatasource.ProvideService(), // the client
			&pluginDatasourceImpl{
				startup: v1.Now(),
			},
			&pluginDatasourceImpl{}, // stub
			&actest.FakeAccessControl{ExpectedEvaluate: true},
			true, // show query types
		)
	}

	return nil, fmt.Errorf("unsupported group")
}

func (p *DummyAPIFactory) Shutdown() {}

// Simple stub for standalone datasource testing
type pluginDatasourceImpl struct {
	startup v1.Time
}

var (
	_ datasource.PluginDatasourceProvider = (*pluginDatasourceImpl)(nil)
)

// Get implements PluginDatasourceProvider.
func (p *pluginDatasourceImpl) Get(ctx context.Context, uid string) (*v0alpha1.DataSourceConnection, error) {
	all, err := p.List(ctx)
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
func (p *pluginDatasourceImpl) List(ctx context.Context) (*v0alpha1.DataSourceConnectionList, error) {
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
func (*pluginDatasourceImpl) GetInstanceSettings(ctx context.Context, uid string) (*backend.DataSourceInstanceSettings, error) {
	return &backend.DataSourceInstanceSettings{}, nil
}

// PluginContextWrapper
func (*pluginDatasourceImpl) PluginContextForDataSource(ctx context.Context, datasourceSettings *backend.DataSourceInstanceSettings) (backend.PluginContext, error) {
	return backend.PluginContext{DataSourceInstanceSettings: datasourceSettings}, nil
}

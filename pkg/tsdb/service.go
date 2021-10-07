package tsdb

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudmonitoring"
	_ "github.com/grafana/grafana/pkg/tsdb/postgres"
)

// NewService returns a new Service.
func NewService(
	cfg *setting.Cfg,
	pluginManager plugins.Manager,
	backendPluginManager backendplugin.Manager,
	oauthTokenService *oauthtoken.Service,
	dataSourcesService *datasources.Service,
	cloudMonitoringService *cloudmonitoring.Service,
) *Service {
	s := newService(cfg, pluginManager, backendPluginManager, oauthTokenService, dataSourcesService)

	// register backend data sources using legacy plugin
	// contracts/non-SDK contracts
	s.registry["stackdriver"] = cloudMonitoringService.NewExecutor

	return s
}

func newService(cfg *setting.Cfg, manager plugins.Manager, backendPluginManager backendplugin.Manager,
	oauthTokenService oauthtoken.OAuthTokenService, dataSourcesService *datasources.Service) *Service {
	return &Service{
		Cfg:                  cfg,
		PluginManager:        manager,
		BackendPluginManager: backendPluginManager,
		// nolint:staticcheck // plugins.DataPlugin deprecated
		registry:           map[string]func(*models.DataSource) (plugins.DataPlugin, error){},
		OAuthTokenService:  oauthTokenService,
		DataSourcesService: dataSourcesService,
	}
}

// Service handles data requests to data sources.
type Service struct {
	Cfg                  *setting.Cfg
	PluginManager        plugins.Manager
	BackendPluginManager backendplugin.Manager
	OAuthTokenService    oauthtoken.OAuthTokenService
	DataSourcesService   *datasources.Service
	//nolint: staticcheck // plugins.DataPlugin deprecated
	registry map[string]func(*models.DataSource) (plugins.DataPlugin, error)
}

//nolint: staticcheck // plugins.DataPlugin deprecated
func (s *Service) HandleRequest(ctx context.Context, ds *models.DataSource, query plugins.DataQuery) (plugins.DataResponse, error) {
	if factory, exists := s.registry[ds.Type]; exists {
		var err error
		plugin, err := factory(ds)
		if err != nil {
			//nolint: staticcheck // plugins.DataPlugin deprecated
			return plugins.DataResponse{}, fmt.Errorf("could not instantiate endpoint for data plugin %q: %w",
				ds.Type, err)
		}

		return plugin.DataQuery(ctx, ds, query)
	}
	return dataPluginQueryAdapter(ds.Type, s.BackendPluginManager, s.OAuthTokenService, s.DataSourcesService).
		DataQuery(ctx, ds, query)
}

// RegisterQueryHandler registers a query handler factory.
// This is only exposed for tests!
//nolint: staticcheck // plugins.DataPlugin deprecated
func (s *Service) RegisterQueryHandler(name string, factory func(*models.DataSource) (plugins.DataPlugin, error)) {
	s.registry[name] = factory
}

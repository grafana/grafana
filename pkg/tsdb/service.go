package tsdb

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/builtin"
	"github.com/grafana/grafana/pkg/tsdb/cloudmonitoring"
	"github.com/grafana/grafana/pkg/tsdb/mssql"
	"github.com/grafana/grafana/pkg/tsdb/mysql"
	"github.com/grafana/grafana/pkg/tsdb/postgres"
)

// NewService returns a new Service.
func NewService(
	cfg *setting.Cfg, pluginManager plugins.Manager, backendPluginManager backendplugin.Manager,
	oauthTokenService *oauthtoken.Service, httpClientProvider httpclient.Provider,
	cloudMonitoringService *cloudmonitoring.Service,
	postgresService *postgres.PostgresService,
	buildinGrafanaDS *builtin.BuiltinGrafanaDatasource,
) *Service {
	s := newService(cfg, pluginManager, backendPluginManager, oauthTokenService, buildinGrafanaDS)

	// register backend data sources using legacy plugin
	// contracts/non-SDK contracts
	s.registry["mssql"] = mssql.NewExecutor
	s.registry["postgres"] = postgresService.NewExecutor
	s.registry["mysql"] = mysql.New(httpClientProvider)
	s.registry["stackdriver"] = cloudMonitoringService.NewExecutor

	return s
}

func newService(cfg *setting.Cfg, manager plugins.Manager, backendPluginManager backendplugin.Manager,
	oauthTokenService oauthtoken.OAuthTokenService,
	buildinGrafanaDS *builtin.BuiltinGrafanaDatasource) *Service {
	return &Service{
		Cfg:                  cfg,
		PluginManager:        manager,
		BackendPluginManager: backendPluginManager,
		// nolint:staticcheck // plugins.DataPlugin deprecated
		registry:          map[string]func(*models.DataSource) (plugins.DataPlugin, error){},
		OAuthTokenService: oauthTokenService,
		buildinGrafanaDS:  buildinGrafanaDS,
	}
}

// Service handles data requests to data sources.
type Service struct {
	Cfg                  *setting.Cfg
	PluginManager        plugins.Manager
	BackendPluginManager backendplugin.Manager
	OAuthTokenService    oauthtoken.OAuthTokenService
	buildinGrafanaDS     *builtin.BuiltinGrafanaDatasource

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
	handler := backend.QueryDataHandler(s.BackendPluginManager)
	if ds.Type == "grafana" {
		handler = s.buildinGrafanaDS
	}

	return dataPluginQueryAdapter(ds.Type, handler, s.OAuthTokenService).DataQuery(ctx, ds, query)
}

// RegisterQueryHandler registers a query handler factory.
// This is only exposed for tests!
//nolint: staticcheck // plugins.DataPlugin deprecated
func (s *Service) RegisterQueryHandler(name string, factory func(*models.DataSource) (plugins.DataPlugin, error)) {
	s.registry[name] = factory
}

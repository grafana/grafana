package tsdb

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/setting"
	_ "github.com/grafana/grafana/pkg/tsdb/postgres"
)

// NewService returns a new Service.
func NewService(
	cfg *setting.Cfg, backendPluginManager backendplugin.Manager,
	oauthTokenService *oauthtoken.Service, dataSourcesService *datasources.Service) *Service {
	return newService(cfg, backendPluginManager, oauthTokenService, dataSourcesService)
}

func newService(cfg *setting.Cfg, backendPluginManager backendplugin.Manager,
	oauthTokenService oauthtoken.OAuthTokenService, dataSourcesService *datasources.Service) *Service {
	return &Service{
		Cfg:                  cfg,
		BackendPluginManager: backendPluginManager,
		OAuthTokenService:    oauthTokenService,
		DataSourcesService:   dataSourcesService,
	}
}

// Service handles data requests to data sources.
type Service struct {
	Cfg                  *setting.Cfg
	BackendPluginManager backendplugin.Manager
	OAuthTokenService    oauthtoken.OAuthTokenService
	DataSourcesService   *datasources.Service
}

//nolint: staticcheck // plugins.DataPlugin deprecated
func (s *Service) HandleRequest(ctx context.Context, ds *models.DataSource, query plugins.DataQuery) (plugins.DataResponse, error) {
	return dataPluginQueryAdapter(ds.Type, s.BackendPluginManager, s.OAuthTokenService, s.DataSourcesService).DataQuery(ctx, ds, query)
}

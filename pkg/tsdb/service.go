package tsdb

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/setting"
	_ "github.com/grafana/grafana/pkg/tsdb/postgres"
)

// NewService returns a new Service.
func NewService(
	cfg *setting.Cfg, pluginsClient plugins.Client, oauthTokenService *oauthtoken.Service,
	dataSourcesService *datasources.Service) *Service {
	return newService(cfg, pluginsClient, oauthTokenService, dataSourcesService)
}

func newService(cfg *setting.Cfg, pluginsClient plugins.Client, oauthTokenService oauthtoken.OAuthTokenService,
	dataSourcesService *datasources.Service) *Service {
	return &Service{
		Cfg:                cfg,
		pluginsClient:      pluginsClient,
		OAuthTokenService:  oauthTokenService,
		DataSourcesService: dataSourcesService,
	}
}

// Service handles data requests to data sources.
type Service struct {
	Cfg                *setting.Cfg
	pluginsClient      plugins.Client
	OAuthTokenService  oauthtoken.OAuthTokenService
	DataSourcesService *datasources.Service
}

//nolint: staticcheck // plugins.DataPlugin deprecated
func (s *Service) HandleRequest(ctx context.Context, ds *models.DataSource, query plugins.DataQuery) (plugins.DataResponse, error) {
	return dataPluginQueryAdapter(ds.Type, s.pluginsClient, s.OAuthTokenService, s.DataSourcesService).DataQuery(ctx, ds, query)
}

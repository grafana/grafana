package tsdb

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/setting"
	_ "github.com/grafana/grafana/pkg/tsdb/postgres"
)

// NewService returns a new Service.
func NewService(
	cfg *setting.Cfg, pluginManager plugins.Manager, backendPluginManager backendplugin.Manager,
	oauthTokenService *oauthtoken.Service) *Service {
	return newService(cfg, pluginManager, backendPluginManager, oauthTokenService)
}

func newService(cfg *setting.Cfg, manager plugins.Manager, backendPluginManager backendplugin.Manager,
	oauthTokenService oauthtoken.OAuthTokenService) *Service {
	return &Service{
		Cfg:                  cfg,
		PluginManager:        manager,
		BackendPluginManager: backendPluginManager,
		OAuthTokenService:    oauthTokenService,
	}
}

// Service handles data requests to data sources.
type Service struct {
	Cfg                  *setting.Cfg
	PluginManager        plugins.Manager
	BackendPluginManager backendplugin.Manager
	OAuthTokenService    oauthtoken.OAuthTokenService
}

//nolint: staticcheck // plugins.DataPlugin deprecated
func (s *Service) HandleRequest(ctx context.Context, ds *models.DataSource, query plugins.DataQuery) (plugins.DataResponse, error) {
	return dataPluginQueryAdapter(ds.Type, s.BackendPluginManager, s.OAuthTokenService).DataQuery(ctx, ds, query)
}

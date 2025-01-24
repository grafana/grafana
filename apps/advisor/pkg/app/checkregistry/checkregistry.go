package checkregistry

import (
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/datasourcecheck"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/plugincheck"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

type CheckService interface {
	Checks() []checks.Check
}

type Service struct {
	datasourceSvc         datasources.DataSourceService
	pluginStore           pluginstore.Store
	pluginContextProvider datasource.PluginContextWrapper
	pluginClient          plugins.Client
	pluginRepo            repo.Service
}

func ProvideService(datasourceSvc datasources.DataSourceService, pluginStore pluginstore.Store,
	pluginContextProvider datasource.PluginContextWrapper, pluginClient plugins.Client,
	pluginRepo repo.Service) *Service {
	return &Service{
		datasourceSvc:         datasourceSvc,
		pluginStore:           pluginStore,
		pluginContextProvider: pluginContextProvider,
		pluginClient:          pluginClient,
		pluginRepo:            pluginRepo,
	}
}

func (s *Service) Checks() []checks.Check {
	return []checks.Check{
		datasourcecheck.New(
			s.datasourceSvc,
			s.pluginStore,
			s.pluginContextProvider,
			s.pluginClient,
		),
		plugincheck.New(
			s.pluginStore,
			s.pluginRepo,
		),
	}
}

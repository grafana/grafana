package checkregistry

import (
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/datasourcecheck"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/plugincheck"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugininstaller"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
)

type CheckService interface {
	Checks() []checks.Check
}

type Service struct {
	datasourceSvc         datasources.DataSourceService
	pluginStore           pluginstore.Store
	pluginContextProvider *plugincontext.Provider
	pluginClient          plugins.Client
	pluginRepo            repo.Service
	pluginPreinstall      plugininstaller.Preinstall
	managedPlugins        managedplugins.Manager
	provisionedPlugins    provisionedplugins.Manager
}

func ProvideService(datasourceSvc datasources.DataSourceService, pluginStore pluginstore.Store,
	pluginContextProvider *plugincontext.Provider, pluginClient plugins.Client,
	pluginRepo repo.Service, pluginPreinstall plugininstaller.Preinstall, managedPlugins managedplugins.Manager,
	provisionedPlugins provisionedplugins.Manager,
) *Service {
	return &Service{
		datasourceSvc:         datasourceSvc,
		pluginStore:           pluginStore,
		pluginContextProvider: pluginContextProvider,
		pluginClient:          pluginClient,
		pluginRepo:            pluginRepo,
		pluginPreinstall:      pluginPreinstall,
		managedPlugins:        managedPlugins,
		provisionedPlugins:    provisionedPlugins,
	}
}

func (s *Service) Checks() []checks.Check {
	return []checks.Check{
		datasourcecheck.New(
			s.datasourceSvc,
			s.pluginStore,
			s.pluginContextProvider,
			s.pluginClient,
			s.pluginRepo,
		),
		plugincheck.New(
			s.pluginStore,
			s.pluginRepo,
			s.pluginPreinstall,
			s.managedPlugins,
			s.provisionedPlugins,
		),
	}
}

// AdvisorAppConfig is the configuration received from Grafana to run the app
type AdvisorAppConfig struct {
	CheckRegistry CheckService
	PluginConfig  map[string]string
	StackID       string
}

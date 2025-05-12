package checkregistry

import (
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/authchecks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/datasourcecheck"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/plugincheck"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
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
	updateChecker         pluginchecker.PluginUpdateChecker
	pluginPreinstall      pluginchecker.Preinstall
	managedPlugins        managedplugins.Manager
	provisionedPlugins    provisionedplugins.Manager
	ssoSettingsSvc        ssosettings.Service
	GrafanaVersion        string
}

func ProvideService(datasourceSvc datasources.DataSourceService, pluginStore pluginstore.Store,
	pluginContextProvider *plugincontext.Provider, pluginClient plugins.Client,
	updateChecker pluginchecker.PluginUpdateChecker,
	pluginRepo repo.Service, pluginPreinstall pluginchecker.Preinstall, managedPlugins managedplugins.Manager,
	provisionedPlugins provisionedplugins.Manager, ssoSettingsSvc ssosettings.Service, settings *setting.Cfg,
) *Service {
	return &Service{
		datasourceSvc:         datasourceSvc,
		pluginStore:           pluginStore,
		pluginContextProvider: pluginContextProvider,
		pluginClient:          pluginClient,
		pluginRepo:            pluginRepo,
		updateChecker:         updateChecker,
		pluginPreinstall:      pluginPreinstall,
		managedPlugins:        managedPlugins,
		provisionedPlugins:    provisionedPlugins,
		ssoSettingsSvc:        ssoSettingsSvc,
		GrafanaVersion:        settings.BuildVersion,
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
			s.GrafanaVersion,
		),
		plugincheck.New(
			s.pluginStore,
			s.pluginRepo,
			s.updateChecker,
			s.GrafanaVersion,
		),
		authchecks.New(s.ssoSettingsSvc),
	}
}

// AdvisorAppConfig is the configuration received from Grafana to run the app
type AdvisorAppConfig struct {
	CheckRegistry CheckService
	PluginConfig  map[string]string
	StackID       string
}

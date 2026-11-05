package checkregistry

import (
	"context"

	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/authchecks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/configchecks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/datasourcecheck"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/instancechecks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/plugincheck"
	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

type CheckService interface {
	// Checks returns new instances of all the registered checks.
	Checks() []checks.Check
	// Check returns a new instance of the check with the given ID, or false if there is none.
	Check(id string) (checks.Check, bool)
}

// NamespaceSkipper is implemented by check registries that can tell when the MT scheduler
// should not create checks in a namespace. SkipReason returns an empty reason to schedule it.
type NamespaceSkipper interface {
	SkipReason(ctx context.Context, namespace string) (string, error)
}

type Service struct {
	datasourceSvc         datasources.DataSourceService
	pluginStore           pluginstore.Store
	pluginContextProvider *plugincontext.Provider
	pluginClient          plugins.Client
	pluginRepo            repo.Service
	pluginErrorResolver   plugins.ErrorResolver
	updateChecker         pluginchecker.PluginUpdateChecker
	pluginPreinstall      pluginchecker.Preinstall
	managedPlugins        managedplugins.Manager
	provisionedPlugins    provisionedplugins.Manager
	ssoSettingsSvc        ssosettings.Service
	GrafanaVersion        string
	cfg                   *setting.Cfg
}

func ProvideService(datasourceSvc datasources.DataSourceService, pluginStore pluginstore.Store,
	pluginContextProvider *plugincontext.Provider, pluginClient plugins.Client,
	updateChecker pluginchecker.PluginUpdateChecker,
	pluginRepo repo.Service, pluginPreinstall pluginchecker.Preinstall, managedPlugins managedplugins.Manager,
	provisionedPlugins provisionedplugins.Manager, ssoSettingsSvc ssosettings.Service, cfg *setting.Cfg,
	pluginErrorResolver plugins.ErrorResolver,
) *Service {
	return &Service{
		datasourceSvc:         datasourceSvc,
		pluginStore:           pluginStore,
		pluginContextProvider: pluginContextProvider,
		pluginClient:          pluginClient,
		pluginRepo:            pluginRepo,
		pluginErrorResolver:   pluginErrorResolver,
		updateChecker:         updateChecker,
		pluginPreinstall:      pluginPreinstall,
		managedPlugins:        managedPlugins,
		provisionedPlugins:    provisionedPlugins,
		ssoSettingsSvc:        ssoSettingsSvc,
		GrafanaVersion:        cfg.BuildVersion,
		cfg:                   cfg,
	}
}

// checkIDs lists the registered checks, in the order Checks returns them.
var checkIDs = []string{
	datasourcecheck.CheckID,
	plugincheck.CheckID,
	authchecks.CheckID,
	configchecks.CheckID,
	instancechecks.CheckID,
}

func (s *Service) Checks() []checks.Check {
	res := make([]checks.Check, 0, len(checkIDs))
	for _, id := range checkIDs {
		if c, ok := s.Check(id); ok {
			res = append(res, c)
		}
	}
	return res
}

func (s *Service) Check(id string) (checks.Check, bool) {
	switch id {
	case datasourcecheck.CheckID:
		return datasourcecheck.New(
			s.datasourceSvc,
			s.pluginStore,
			s.pluginRepo,
			s.GrafanaVersion,
			&checks.HealthCheckerImpl{
				PluginContextProvider: s.pluginContextProvider,
				PluginClient:          s.pluginClient,
			},
		), true
	case plugincheck.CheckID:
		return plugincheck.New(
			s.pluginStore,
			s.pluginRepo,
			s.updateChecker,
			s.pluginErrorResolver,
			s.GrafanaVersion,
		), true
	case authchecks.CheckID:
		return authchecks.New(s.ssoSettingsSvc), true
	case configchecks.CheckID:
		return configchecks.New(s.cfg), true
	case instancechecks.CheckID:
		return instancechecks.New(s.cfg), true
	default:
		return nil, false
	}
}

// AdvisorAppConfig is the configuration received from Grafana to run the app
type AdvisorAppConfig struct {
	CheckRegistry CheckService
	PluginConfig  map[string]string
	StackID       string
	OrgService    org.Service
	// LeaderElector, when set check scheduler only runs on the replica holding the elector's lease
	LeaderElector leaderelection.Elector
}

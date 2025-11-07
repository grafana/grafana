package mockchecks

import (
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry/mockchecks/mocksvcs"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/datasourcecheck"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/plugincheck"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

// mockchecks.CheckRegistry is a mock implementation of the checkregistry.CheckService interface
// TODO: Add mocked checks here
type CheckRegistry struct {
	datasourceSvc         datasources.DataSourceService
	pluginStore           pluginstore.Store
	pluginClient          plugins.Client
	pluginRepo            repo.Service
	GrafanaVersion        string
	pluginContextProvider datasourcecheck.PluginContextProvider
	updateChecker         pluginchecker.PluginUpdateChecker
	pluginErrorResolver   plugins.ErrorResolver
}

func (m *CheckRegistry) Checks() []checks.Check {
	return []checks.Check{
		datasourcecheck.New(
			m.datasourceSvc,
			m.pluginStore,
			m.pluginContextProvider,
			m.pluginClient,
			m.pluginRepo,
			m.GrafanaVersion,
		),
		plugincheck.New(
			m.pluginStore,
			m.pluginRepo,
			m.updateChecker,
			m.pluginErrorResolver,
			m.GrafanaVersion,
		),
	}
}

func New() *CheckRegistry {
	return &CheckRegistry{
		datasourceSvc:         &mocksvcs.DatasourceSvc{},
		pluginStore:           &mocksvcs.PluginStore{},
		pluginClient:          &mocksvcs.PluginClient{},
		pluginRepo:            &mocksvcs.PluginRepo{},
		pluginContextProvider: &mocksvcs.PluginContextProvider{},
		updateChecker:         &mocksvcs.UpdateChecker{},
		pluginErrorResolver:   &mocksvcs.PluginErrorResolver{},
		GrafanaVersion:        "1.0.0",
	}
}

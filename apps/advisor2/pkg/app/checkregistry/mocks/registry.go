package mocks

import (
	"github.com/grafana/grafana/apps/advisor2/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor2/pkg/app/checks/authchecks"
	"github.com/grafana/grafana/apps/advisor2/pkg/app/checks/configchecks"
	"github.com/grafana/grafana/apps/advisor2/pkg/app/checks/datasourcecheck"
	"github.com/grafana/grafana/apps/advisor2/pkg/app/checks/instancechecks"
	"github.com/grafana/grafana/apps/advisor2/pkg/app/checks/plugincheck"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

// MockCheckRegistry implements the CheckService interface for testing
type MockCheckRegistry struct {
	pluginStore           pluginstore.Store
	pluginRepo            repo.Service
	updateChecker         pluginchecker.PluginUpdateChecker
	pluginErrorResolver   plugins.ErrorResolver
	pluginContextProvider *mockPluginContextProvider
	pluginClient          *mockPluginClient
	datasourceSvc         datasources.DataSourceService
	managedPlugins        managedplugins.Manager
	provisionedPlugins    provisionedplugins.Manager
	ssoSettingsSvc        ssosettings.Service
	cfg                   *setting.Cfg
	GrafanaVersion        string
}

func (s *MockCheckRegistry) Checks() []checks.Check {
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
			s.pluginErrorResolver,
			s.GrafanaVersion,
		),
		authchecks.New(s.ssoSettingsSvc),
		configchecks.New(s.cfg),
		instancechecks.New(s.cfg),
	}
}

// NewMockCheckRegistry creates a new mock check registry with sample dependencies
func NewMockCheckRegistry() *MockCheckRegistry {
	// Use the proper NewCfg() function to initialize with INI file
	cfg := setting.NewCfg()
	cfg.BuildVersion = "10.0.0"
	cfg.AppURL = "http://localhost:3000"
	cfg.DataPath = "/var/lib/grafana"

	return &MockCheckRegistry{
		pluginStore:           &mockPluginStore{},
		pluginRepo:            &mockPluginRepo{},
		updateChecker:         &mockUpdateChecker{},
		pluginErrorResolver:   &mockPluginErrorResolver{},
		pluginContextProvider: &mockPluginContextProvider{},
		pluginClient:          &mockPluginClient{},
		datasourceSvc:         &mockDataSourceService{},
		managedPlugins:        &mockManagedPlugins{},
		provisionedPlugins:    &mockProvisionedPlugins{},
		ssoSettingsSvc:        &mockSSOSettingsService{},
		cfg:                   cfg,
		GrafanaVersion:        cfg.BuildVersion,
	}
}

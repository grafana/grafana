package plugincheck

import (
	"context"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
	"github.com/stretchr/testify/assert"
)

func TestRun(t *testing.T) {
	tests := []struct {
		name               string
		plugins            []pluginstore.Plugin
		pluginInfo         []repo.PluginInfo
		pluginPreinstalled []string
		pluginManaged      []string
		pluginProvisioned  []string
		pluginErrors       []*plugins.Error
		expectedFailures   []advisor.CheckReportFailure
	}{
		{
			name:             "No plugins",
			plugins:          []pluginstore.Plugin{},
			expectedFailures: []advisor.CheckReportFailure{},
		},
		{
			name: "Deprecated plugin",
			plugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin1", Name: "Plugin 1", Info: plugins.Info{Version: "1.0.0"}}},
			},
			pluginInfo: []repo.PluginInfo{
				{Status: "deprecated", Slug: "plugin1", Version: "1.0.0"},
			},
			expectedFailures: []advisor.CheckReportFailure{
				{
					Severity: advisor.CheckReportFailureSeverityHigh,
					StepID:   "deprecation",
					Item:     "Plugin 1",
					ItemID:   "plugin1",
					Links: []advisor.CheckErrorLink{
						{
							Url:     "/plugins/plugin1",
							Message: "View plugin",
						},
					},
				},
			},
		},
		{
			name: "Plugin with update",
			plugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin2", Name: "Plugin 2", Info: plugins.Info{Version: "1.0.0"}}},
			},
			pluginInfo: []repo.PluginInfo{
				{Status: "active", Slug: "plugin2", Version: "1.1.0"},
			},
			expectedFailures: []advisor.CheckReportFailure{
				{
					Severity: advisor.CheckReportFailureSeverityLow,
					StepID:   "update",
					Item:     "Plugin 2",
					ItemID:   "plugin2",
					Links: []advisor.CheckErrorLink{
						{
							Url:     "/plugins/plugin2?page=version-history",
							Message: "Upgrade",
						},
					},
				},
			},
		},
		{
			name: "Plugin with update (non semver)",
			plugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin2", Name: "Plugin 2", Info: plugins.Info{Version: "alpha"}}},
			},
			pluginInfo: []repo.PluginInfo{
				{Status: "active", Slug: "plugin2", Version: "beta"},
			},
			expectedFailures: []advisor.CheckReportFailure{}, // Cannot be compared because the version is not semver
		},
		{
			name: "Plugin pinned",
			plugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin3", Name: "Plugin 3", Info: plugins.Info{Version: "1.0.0"}}},
			},
			pluginInfo: []repo.PluginInfo{
				{Status: "deprecated", Slug: "plugin3"}, // This should be ignored
			},
			pluginPreinstalled: []string{"plugin3"},
			expectedFailures:   []advisor.CheckReportFailure{},
		},
		{
			name: "Managed plugin",
			plugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin4", Name: "Plugin 4", Info: plugins.Info{Version: "1.0.0"}}},
			},
			pluginInfo: []repo.PluginInfo{
				{Status: "deprecated", Slug: "plugin4", Version: "1.1.0"}, // This should be ignored
			},
			pluginManaged:    []string{"plugin4"},
			expectedFailures: []advisor.CheckReportFailure{},
		},
		{
			name: "Provisioned plugin",
			plugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin5", Name: "Plugin 5", Info: plugins.Info{Version: "1.0.0"}}},
			},
			pluginInfo: []repo.PluginInfo{
				{Status: "deprecated", Slug: "plugin5", Version: "1.1.0"}, // This should be ignored
			},
			pluginProvisioned: []string{"plugin5"},
			expectedFailures:  []advisor.CheckReportFailure{},
		},
		{
			name: "Invalid signatures",
			plugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin6", Name: "Plugin 6", Info: plugins.Info{Version: "1.0.0"}}, Signature: plugins.SignatureStatusInvalid},
				{JSONData: plugins.JSONData{ID: "plugin7", Name: "Plugin 7", Info: plugins.Info{Version: "1.0.0"}}, Signature: plugins.SignatureStatusModified},
				{JSONData: plugins.JSONData{ID: "plugin8", Name: "Plugin 8", Info: plugins.Info{Version: "1.0.0"}}, Signature: plugins.SignatureStatusUnsigned},
			},
			pluginInfo: []repo.PluginInfo{
				{Status: "active", Slug: "plugin6", Version: "1.0.0"},
				{Status: "active", Slug: "plugin7", Version: "1.0.0"},
				{Status: "active", Slug: "plugin8", Version: "1.0.0"},
			},
			pluginErrors: []*plugins.Error{
				{PluginID: "plugin9", ErrorCode: plugins.ErrorCodeSignatureInvalid},
				{PluginID: "plugin10", ErrorCode: plugins.ErrorCodeSignatureModified},
				{PluginID: "plugin11", ErrorCode: plugins.ErrorCodeSignatureMissing},
				{PluginID: "plugin12", ErrorCode: plugins.ErrorCodeFailedBackendStart}, // This should be ignored atm
			},
			expectedFailures: []advisor.CheckReportFailure{
				{
					Severity: advisor.CheckReportFailureSeverityLow,
					StepID:   UnsignedStepID,
					Item:     "Plugin 6",
					ItemID:   "plugin6",
					Links:    []advisor.CheckErrorLink{{Url: "/plugins/plugin6", Message: "View plugin"}},
				},
				{
					Severity: advisor.CheckReportFailureSeverityLow,
					StepID:   UnsignedStepID,
					Item:     "Plugin 7",
					ItemID:   "plugin7",
					Links:    []advisor.CheckErrorLink{{Url: "/plugins/plugin7", Message: "View plugin"}},
				},
				{
					Severity: advisor.CheckReportFailureSeverityLow,
					StepID:   UnsignedStepID,
					Item:     "Plugin 8",
					ItemID:   "plugin8",
					Links:    []advisor.CheckErrorLink{{Url: "/plugins/plugin8", Message: "View plugin"}},
				},
				{
					Severity: advisor.CheckReportFailureSeverityHigh,
					StepID:   UnsignedStepID,
					Item:     "plugin9",
					ItemID:   "plugin9",
					Links:    []advisor.CheckErrorLink{},
				},
				{
					Severity: advisor.CheckReportFailureSeverityHigh,
					StepID:   UnsignedStepID,
					Item:     "plugin10",
					ItemID:   "plugin10",
					Links:    []advisor.CheckErrorLink{},
				},
				{
					Severity: advisor.CheckReportFailureSeverityHigh,
					StepID:   UnsignedStepID,
					Item:     "plugin11",
					ItemID:   "plugin11",
					Links:    []advisor.CheckErrorLink{},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pluginStore := &mockPluginStore{plugins: tt.plugins}
			pluginRepo := &mockPluginRepo{
				pluginInfo: tt.pluginInfo,
			}
			pluginPreinstall := &mockPluginPreinstall{pinned: tt.pluginPreinstalled}
			managedPlugins := &mockManagedPlugins{managed: tt.pluginManaged}
			provisionedPlugins := &mockProvisionedPlugins{provisioned: tt.pluginProvisioned}
			updateChecker := pluginchecker.ProvideService(managedPlugins, provisionedPlugins, pluginPreinstall)
			pluginErrorResolver := &mockPluginErrorResolver{pluginErrors: tt.pluginErrors}
			check := New(pluginStore, pluginRepo, updateChecker, pluginErrorResolver, "12.0.0")

			items, err := check.Items(context.Background())
			assert.NoError(t, err)
			failures := []advisor.CheckReportFailure{}
			err = check.Init(context.Background())
			assert.NoError(t, err)
			for _, step := range check.Steps() {
				for _, item := range items {
					stepFailures, err := step.Run(context.Background(), logging.DefaultLogger, &advisor.CheckSpec{}, item)
					assert.NoError(t, err)
					if len(stepFailures) > 0 {
						failures = append(failures, stepFailures...)
					}
				}
			}
			assert.NoError(t, err)
			assert.Equal(t, len(tt.plugins)+len(tt.pluginErrors), len(items))
			assert.ElementsMatch(t, tt.expectedFailures, failures)
		})
	}
}

func TestCheck_Item(t *testing.T) {
	t.Run("should return nil when plugin is not found", func(t *testing.T) {
		pluginStore := &mockPluginStore{plugins: []pluginstore.Plugin{}}
		check := &check{
			PluginStore: pluginStore,
		}
		item, err := check.Item(context.Background(), "invalid-uid")
		assert.NoError(t, err)
		assert.Nil(t, item)
	})
}

type mockPluginStore struct {
	pluginstore.Store
	plugins []pluginstore.Plugin
}

func (m *mockPluginStore) Plugins(ctx context.Context, t ...plugins.Type) []pluginstore.Plugin {
	return m.plugins
}

func (m *mockPluginStore) Plugin(ctx context.Context, id string) (pluginstore.Plugin, bool) {
	if len(m.plugins) == 0 {
		return pluginstore.Plugin{}, false
	}
	return m.plugins[0], true
}

type mockPluginRepo struct {
	repo.Service
	pluginInfo []repo.PluginInfo
}

func (m *mockPluginRepo) GetPluginsInfo(ctx context.Context, options repo.GetPluginsInfoOptions, compatOpts repo.CompatOpts) ([]repo.PluginInfo, error) {
	return m.pluginInfo, nil
}

type mockPluginPreinstall struct {
	pluginchecker.Preinstall
	pinned []string
}

func (m *mockPluginPreinstall) IsPinned(pluginID string) bool {
	for _, p := range m.pinned {
		if p == pluginID {
			return true
		}
	}
	return false
}

type mockManagedPlugins struct {
	managedplugins.Manager
	managed []string
}

func (m *mockManagedPlugins) ManagedPlugins(ctx context.Context) []string {
	return m.managed
}

type mockProvisionedPlugins struct {
	provisionedplugins.Manager
	provisioned []string
}

func (m *mockProvisionedPlugins) ProvisionedPlugins(ctx context.Context) ([]string, error) {
	return m.provisioned, nil
}

type mockPluginErrorResolver struct {
	plugins.ErrorResolver
	pluginErrors []*plugins.Error
}

func (m *mockPluginErrorResolver) PluginErrors(ctx context.Context) []*plugins.Error {
	return m.pluginErrors
}

func (m *mockPluginErrorResolver) PluginError(ctx context.Context, id string) *plugins.Error {
	for _, err := range m.pluginErrors {
		if err.PluginID == id {
			return err
		}
	}
	return nil
}

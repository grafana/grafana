package externaloverrides_test

import (
	"context"
	"testing"

	"gopkg.in/ini.v1"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pipeline"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/setting"
)

func canvasBundles() []*plugins.FoundBundle {
	return []*plugins.FoundBundle{
		{Primary: plugins.FoundPlugin{JSONData: plugins.JSONData{ID: "canvas"}}},
	}
}

func externalPlugin() *plugins.Plugin {
	return &plugins.Plugin{JSONData: plugins.JSONData{ID: "grafana-canvas-panel"}}
}

func buildCfg(t *testing.T, iniStr string) *config.PluginManagementCfg {
	t.Helper()
	raw, err := ini.Load([]byte(iniStr))
	require.NoError(t, err)
	cfg := setting.NewCfg()
	cfg.Raw = raw
	pCfg, err := pluginconfig.ProvidePluginManagementConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
	require.NoError(t, err)
	return pCfg
}

func TestExternalOverride_BothKeysConfigured_CoreSuppressedAndAliasInjected(t *testing.T) {
	pCfg := buildCfg(t, `
[plugins]
preinstall_sync = grafana-canvas-panel

[plugin.canvas]
as_external = true

[plugin.grafana-canvas-panel]
alias_ids = canvas`)

	filtered, err := pipeline.NewAsExternalStep(pCfg).Filter(plugins.ClassCore, canvasBundles())
	require.NoError(t, err)
	require.Empty(t, filtered, "core canvas should be suppressed when both keys are set")

	decorated, err := pipeline.ExternalPluginOverridesDecorateFunc(pCfg.ActiveExternalOverrides)(context.Background(), externalPlugin())
	require.NoError(t, err)
	require.Contains(t, decorated.AliasIDs, "canvas", "canvas alias should be injected into external plugin")
}

func TestExternalOverride_NeitherKeyConfigured_CoreLoadsAndNoAlias(t *testing.T) {
	pCfg := buildCfg(t, `[plugins]`)

	filtered, err := pipeline.NewAsExternalStep(pCfg).Filter(plugins.ClassCore, canvasBundles())
	require.NoError(t, err)
	require.Len(t, filtered, 1, "core canvas should load normally when no keys are set")
	require.Equal(t, "canvas", filtered[0].Primary.JSONData.ID)

	decorated, err := pipeline.ExternalPluginOverridesDecorateFunc(pCfg.ActiveExternalOverrides)(context.Background(), externalPlugin())
	require.NoError(t, err)
	require.NotContains(t, decorated.AliasIDs, "canvas", "canvas alias should not be injected")
}

func TestExternalOverride_AsExternalOnlyNoAliasIds_CoreNotSuppressedNoAlias(t *testing.T) {
	pCfg := buildCfg(t, `
[plugins]

[plugin.canvas]
as_external = true`)

	filtered, err := pipeline.NewAsExternalStep(pCfg).Filter(plugins.ClassCore, canvasBundles())
	require.NoError(t, err)
	require.Len(t, filtered, 1, "core canvas should NOT be suppressed when alias_ids is missing")
	require.Equal(t, "canvas", filtered[0].Primary.JSONData.ID)

	decorated, err := pipeline.ExternalPluginOverridesDecorateFunc(pCfg.ActiveExternalOverrides)(context.Background(), externalPlugin())
	require.NoError(t, err)
	require.NotContains(t, decorated.AliasIDs, "canvas", "canvas alias should not be injected")
}

func TestExternalOverride_AliasIdsOnlyNoAsExternal_CoreNotSuppressedNoAlias(t *testing.T) {
	pCfg := buildCfg(t, `
[plugins]

[plugin.grafana-canvas-panel]
alias_ids = canvas`)

	filtered, err := pipeline.NewAsExternalStep(pCfg).Filter(plugins.ClassCore, canvasBundles())
	require.NoError(t, err)
	require.Len(t, filtered, 1, "core canvas should NOT be suppressed when as_external is missing")
	require.Equal(t, "canvas", filtered[0].Primary.JSONData.ID)

	decorated, err := pipeline.ExternalPluginOverridesDecorateFunc(pCfg.ActiveExternalOverrides)(context.Background(), externalPlugin())
	require.NoError(t, err)
	require.NotContains(t, decorated.AliasIDs, "canvas", "canvas alias should not be injected")
}

func TestExternalOverride_PermanentStage_CoreSuppressedAndAliasAlwaysInjected(t *testing.T) {
	pCfg := buildCfg(t, `[plugins]`)

	// Simulate OverrideStagePermanent by injecting the override directly —
	// at permanent stage the core plugin has been deleted, so no ini keys are needed.
	pCfg.ActiveExternalOverrides = []config.ExternalOverride{
		{CorePluginID: "canvas", ExternalPluginID: "grafana-canvas-panel"},
	}

	filtered, err := pipeline.NewAsExternalStep(pCfg).Filter(plugins.ClassCore, canvasBundles())
	require.NoError(t, err)
	require.Empty(t, filtered, "core canvas should be suppressed at permanent stage")

	decorated, err := pipeline.ExternalPluginOverridesDecorateFunc(pCfg.ActiveExternalOverrides)(context.Background(), externalPlugin())
	require.NoError(t, err)
	require.Contains(t, decorated.AliasIDs, "canvas", "canvas alias should always be injected at permanent stage")
}

func TestExternalOverride_NonRegistryPlugin_NotSuppressedEvenWithAsExternal(t *testing.T) {
	pCfg := buildCfg(t, `
[plugins]

[plugin.elasticsearch]
as_external = true`)

	bundles := []*plugins.FoundBundle{
		{Primary: plugins.FoundPlugin{JSONData: plugins.JSONData{ID: "elasticsearch"}}},
		{Primary: plugins.FoundPlugin{JSONData: plugins.JSONData{ID: "canvas"}}},
	}

	filtered, err := pipeline.NewAsExternalStep(pCfg).Filter(plugins.ClassCore, bundles)
	require.NoError(t, err)
	require.Len(t, filtered, 2, "non-registry plugins must not be suppressed — only the allowlist controls suppression")
}

func TestExternalOverride_NonOverrideCorePanel_PassesThroughUnaffected(t *testing.T) {
	pCfg := buildCfg(t, `
[plugins]
preinstall_sync = grafana-canvas-panel

[plugin.canvas]
as_external = true

[plugin.grafana-canvas-panel]
alias_ids = canvas`)

	timeseries := &plugins.FoundBundle{
		Primary: plugins.FoundPlugin{JSONData: plugins.JSONData{ID: "timeseries"}},
	}
	bundles := []*plugins.FoundBundle{
		{Primary: plugins.FoundPlugin{JSONData: plugins.JSONData{ID: "canvas"}}},
		timeseries,
	}

	filtered, err := pipeline.NewAsExternalStep(pCfg).Filter(plugins.ClassCore, bundles)
	require.NoError(t, err)
	require.Len(t, filtered, 1, "only non-override core panels should pass through")
	require.Equal(t, "timeseries", filtered[0].Primary.JSONData.ID)
}

func TestExternalOverride_DatasourcePlugin_NotAffectedByOverrides(t *testing.T) {
	pCfg := buildCfg(t, `
[plugins]
preinstall_sync = grafana-canvas-panel

[plugin.canvas]
as_external = true

[plugin.grafana-canvas-panel]
alias_ids = canvas`)

	datasourceBundles := []*plugins.FoundBundle{
		{Primary: plugins.FoundPlugin{JSONData: plugins.JSONData{ID: "prometheus"}}},
		{Primary: plugins.FoundPlugin{JSONData: plugins.JSONData{ID: "loki"}}},
	}

	filtered, err := pipeline.NewAsExternalStep(pCfg).Filter(plugins.ClassCore, datasourceBundles)
	require.NoError(t, err)
	require.Len(t, filtered, 2, "non-allowlisted core plugins should never be suppressed by canvas override")
	require.Equal(t, "prometheus", filtered[0].Primary.JSONData.ID)
	require.Equal(t, "loki", filtered[1].Primary.JSONData.ID)

	prometheus := &plugins.Plugin{JSONData: plugins.JSONData{ID: "prometheus"}}
	decorated, err := pipeline.ExternalPluginOverridesDecorateFunc(pCfg.ActiveExternalOverrides)(context.Background(), prometheus)
	require.NoError(t, err)
	require.Empty(t, decorated.AliasIDs, "datasource plugin should receive no alias injection")
}

package diagnostics

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

func testCfg() *setting.Cfg {
	return &setting.Cfg{
		BuildVersion: "12.3.0",
		BuildCommit:  "abc1234",
		BuildBranch:  "HEAD",
		BuildStamp:   1761000000,
		Packaging:    "deb",
		Env:          "production",
	}
}

func externalPlugin() pluginstore.Plugin {
	return pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:      "grafana-mongodb-datasource",
			Type:    plugins.TypeDataSource,
			Backend: true,
			Info:    plugins.Info{Version: "1.4.2"},
		},
		Class:         plugins.ClassExternal,
		Signature:     plugins.SignatureStatusValid,
		SignatureType: plugins.SignatureTypeCommercial,
		SignatureOrg:  "Grafana Labs",
	}
}

// corePlugin mirrors a core datasource: loaded from Grafana's own binary and carrying NO version of
// its own (the loader blanks the "%VERSION%" placeholder).
func corePlugin() pluginstore.Plugin {
	return pluginstore.Plugin{
		JSONData: plugins.JSONData{ID: "prometheus", Type: plugins.TypeDataSource, Backend: true},
		Class:    plugins.ClassCore,
	}
}

func TestCollectEnvironment(t *testing.T) {
	store := pluginstore.NewFakePluginStore(externalPlugin(), corePlugin(), pluginstore.Plugin{
		JSONData: plugins.JSONData{ID: "timeseries", Type: plugins.TypePanel},
		Class:    plugins.ClassCore,
	})

	var refs EnvironmentRefs
	refs.AddDatasource("P123", "grafana-mongodb-datasource")
	refs.AddDatasource("P456", "prometheus")
	refs.AddPanelPluginID("timeseries")

	env := CollectEnvironment(context.Background(), testCfg(), store, refs)
	require.NotNil(t, env)

	require.Equal(t, environmentArtifactVersion, env.Version)
	require.Equal(t, "12.3.0", env.Grafana.Version)
	require.Equal(t, "abc1234", env.Grafana.Commit)
	require.Equal(t, "deb", env.Grafana.Packaging)
	require.Equal(t, "Open Source", env.Grafana.Edition, "edition follows the build flag, not a license")

	// The UID -> plugin ID join, so manifest.panels[].datasources (UIDs) can reach a version.
	require.Equal(t, map[string]string{"P123": "grafana-mongodb-datasource", "P456": "prometheus"}, env.Datasources)

	external := env.Plugins["grafana-mongodb-datasource"]
	require.Equal(t, "1.4.2", external.Version)
	require.Equal(t, "external", external.Class)
	require.Equal(t, "datasource", external.Type)
	require.True(t, external.Backend)
	require.Equal(t, "valid", external.Signature)
	require.Equal(t, "commercial", external.SignatureType)
	require.Equal(t, "Grafana Labs", external.SignatureOrg)

	// A core plugin ships no version of its own: empty version + class "core" means "this Grafana build".
	core := env.Plugins["prometheus"]
	require.Empty(t, core.Version)
	require.Equal(t, "core", core.Class)
	require.False(t, core.NotInstalled)

	require.Contains(t, env.Plugins, "timeseries", "the panel's viz plugin is recorded too")
	require.Len(t, env.Plugins, 3)
}

func TestCollectEnvironment_enterpriseEdition(t *testing.T) {
	cfg := testCfg()
	cfg.IsEnterprise = true
	cfg.EnterpriseBuildCommit = "ent9876"

	env := CollectEnvironment(context.Background(), cfg, nil, EnvironmentRefs{})
	require.NotNil(t, env)
	require.Equal(t, "Enterprise", env.Grafana.Edition)
	require.Equal(t, "ent9876", env.Grafana.EnterpriseCommit)
}

func TestCollectEnvironment_dropsNAEnterpriseCommit(t *testing.T) {
	cfg := testCfg()
	cfg.EnterpriseBuildCommit = "NA" // what an OSS build sets

	env := CollectEnvironment(context.Background(), cfg, nil, EnvironmentRefs{})
	require.NotNil(t, env)
	require.Empty(t, env.Grafana.EnterpriseCommit)
}

func TestCollectEnvironment_marksPluginNotInstalled(t *testing.T) {
	// A dashboard imported from an environment that had the plugin: the absence IS the finding.
	var refs EnvironmentRefs
	refs.AddDatasource("P123", "grafana-mongodb-datasource")

	env := CollectEnvironment(context.Background(), testCfg(), pluginstore.NewFakePluginStore(), refs)
	require.NotNil(t, env)
	require.True(t, env.Plugins["grafana-mongodb-datasource"].NotInstalled)
	require.Empty(t, env.Plugins["grafana-mongodb-datasource"].Version)
}

func TestCollectEnvironment_recordsPluginLoadError(t *testing.T) {
	broken := externalPlugin()
	broken.Error = &plugins.Error{PluginID: broken.ID, ErrorCode: plugins.ErrorCodeSignatureModified}

	var refs EnvironmentRefs
	refs.AddDatasource("P123", broken.ID)

	env := CollectEnvironment(context.Background(), testCfg(), pluginstore.NewFakePluginStore(broken), refs)
	require.NotNil(t, env)
	require.NotEmpty(t, env.Plugins[broken.ID].Error)
}

func TestCollectEnvironment_withoutCfgOrStore(t *testing.T) {
	// No config -> no artifact at all, rather than one that reads like "version unknown".
	require.Nil(t, CollectEnvironment(context.Background(), nil, nil, EnvironmentRefs{}))

	// No store -> the referenced IDs are still recorded, just without versions.
	var refs EnvironmentRefs
	refs.AddPanelPluginID("timeseries")
	env := CollectEnvironment(context.Background(), testCfg(), nil, refs)
	require.NotNil(t, env)
	require.Contains(t, env.Plugins, "timeseries")
	require.Empty(t, env.Plugins["timeseries"].Version)
}

func TestEnvironmentRefs(t *testing.T) {
	var refs EnvironmentRefs
	refs.AddDatasource("", "ignored")        // no UID -> not recorded
	refs.AddDatasource("P123", "prometheus") // resolved
	refs.AddDatasource("P123", "")           // a later blank type must not overwrite it
	refs.AddDatasource("P789", "")           // UID with no type is still worth recording
	refs.AddPanelPluginID("timeseries")
	refs.AddPanelPluginID("timeseries") // deduplicated
	refs.AddPanelPluginID("")           // ignored

	require.Equal(t, map[string]string{"P123": "prometheus", "P789": ""}, refs.DatasourcesByUID)
	require.Equal(t, []string{"timeseries"}, refs.PanelPluginIDs)
	// Sorted, deduplicated, and the empty plugin ID for P789 is dropped.
	require.Equal(t, []string{"prometheus", "timeseries"}, refs.PluginIDs())
}

func TestEnvironmentRefs_Merge(t *testing.T) {
	var all EnvironmentRefs

	var first EnvironmentRefs
	first.AddDatasource("P123", "prometheus")
	first.AddPanelPluginID("timeseries")

	var second EnvironmentRefs
	second.AddDatasource("P456", "loki")
	second.AddPanelPluginID("timeseries") // same viz plugin as the first panel
	second.AddPanelPluginID("table")

	all.Merge(first)
	all.Merge(second)

	require.Equal(t, map[string]string{"P123": "prometheus", "P456": "loki"}, all.DatasourcesByUID)
	require.Equal(t, []string{"loki", "prometheus", "table", "timeseries"}, all.PluginIDs())
}

func TestPanelPluginID(t *testing.T) {
	tests := []struct {
		name  string
		panel string
		want  string
	}{
		{"v1 panel", `{"id":1,"type":"timeseries"}`, "timeseries"},
		{"v2 stable element", `{"kind":"Panel","spec":{"id":1,"vizConfig":{"kind":"VizConfig","group":"timeseries"}}}`, "timeseries"},
		{"v2alpha1 element carries the plugin id in kind", `{"kind":"Panel","spec":{"id":1,"vizConfig":{"kind":"timeseries"}}}`, "timeseries"},
		// Neither save model names a library panel's viz plugin, so both must yield nothing rather than
		// a sentinel the plugin store would report as uninstalled.
		{"v1 library panel carries a sentinel type", `{"id":1,"title":"Shared","libraryPanel":{"uid":"abc","name":"Shared"},"type":"library-panel-ref"}`, ""},
		{"v2 library panel carries no vizConfig", `{"kind":"LibraryPanel","spec":{"id":1,"title":"Shared","libraryPanel":{"uid":"abc","name":"Shared"}}}`, ""},
		{"v2 element with no group never yields the literal VizConfig", `{"kind":"Panel","spec":{"id":1,"vizConfig":{"kind":"VizConfig"}}}`, ""},
		{"v2 element with no vizConfig", `{"kind":"Panel","spec":{"id":1}}`, ""},
		{"malformed", `{not json`, ""},
		{"empty", ``, ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, PanelPluginID(json.RawMessage(tc.panel)))
		})
	}
}

func TestPanelPluginIDs(t *testing.T) {
	v1 := json.RawMessage(`{"panels":[
		{"id":1,"type":"timeseries"},
		{"id":2,"type":"row","panels":[{"id":3,"type":"table"}]},
		{"id":4},
		{"id":5,"libraryPanel":{"uid":"abc","name":"Shared"},"type":"library-panel-ref"}
	]}`)
	require.Equal(t, map[int64]string{1: "timeseries", 2: "row", 3: "table"}, PanelPluginIDs(v1),
		"collapsed row children are indexed too; a panel with no type, and a library panel's sentinel type, are omitted")

	v2 := json.RawMessage(`{"elements":{
		"a":{"kind":"Panel","spec":{"id":1,"vizConfig":{"kind":"VizConfig","group":"timeseries"}}}
	}}`)
	require.Equal(t, map[int64]string{1: "timeseries"}, PanelPluginIDs(v2))

	require.Empty(t, PanelPluginIDs(nil))
}

func TestBundler_Build_writesEnvironment(t *testing.T) {
	var refs EnvironmentRefs
	refs.AddDatasource("P123", "grafana-mongodb-datasource")
	env := CollectEnvironment(context.Background(), testCfg(), pluginstore.NewFakePluginStore(externalPlugin()), refs)

	blob, err := NewBundler(env).Build(nil, nil, json.RawMessage(`{"id":1,"type":"timeseries"}`), nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "environment.json", "the single-panel bundle has no manifest, so this is the only place versions land")

	var got Environment
	require.NoError(t, json.Unmarshal(files["environment.json"], &got))
	require.Equal(t, "12.3.0", got.Grafana.Version)
	require.Equal(t, "1.4.2", got.Plugins["grafana-mongodb-datasource"].Version)

	// Indented like the other JSON artifacts, so it's readable unpacked.
	require.Contains(t, string(files["environment.json"]), "\n  \"grafana\": {")
}

func TestBundler_Build_omitsEnvironmentWhenUnavailable(t *testing.T) {
	blob, err := NewBundler(nil).Build(nil, nil, json.RawMessage(`{"id":1}`), nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotContains(t, readTarGz(t, blob), "environment.json")
}

func TestBundler_BuildDashboard_writesEnvironmentAndPanelPluginIDs(t *testing.T) {
	var refs EnvironmentRefs
	refs.AddDatasource("P123", "grafana-mongodb-datasource")
	refs.AddPanelPluginID("timeseries")
	env := CollectEnvironment(context.Background(), testCfg(), pluginstore.NewFakePluginStore(externalPlugin()), refs)

	panels := []DashboardPanel{{
		ID:          1,
		Title:       "Mongo latency",
		Datasources: []string{"P123"},
		PluginIDs:   []string{"grafana-mongodb-datasource", "timeseries"},
	}}

	blob, err := NewBundler(env).BuildDashboard(json.RawMessage(`{"title":"My dash"}`), panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "environment.json")

	var manifest struct {
		Panels []struct {
			Datasources []string `json:"datasources"`
			PluginIDs   []string `json:"pluginIds"`
		} `json:"panels"`
	}
	require.NoError(t, json.Unmarshal(files["manifest.json"], &manifest))
	require.Len(t, manifest.Panels, 1)
	require.Equal(t, []string{"P123"}, manifest.Panels[0].Datasources)
	require.Equal(t, []string{"grafana-mongodb-datasource", "timeseries"}, manifest.Panels[0].PluginIDs)

	// Versions are recorded ONCE at instance level, not repeated per panel.
	require.NotContains(t, string(files["manifest.json"]), "1.4.2")
	require.Contains(t, string(files["environment.json"]), "1.4.2")
}

func TestCollectEnvironment_boundsPluginError(t *testing.T) {
	broken := externalPlugin()
	broken.Error = &plugins.Error{PluginID: strings.Repeat("x", 4096), ErrorCode: plugins.ErrorCodeSignatureModified}

	var refs EnvironmentRefs
	refs.AddDatasource("P123", broken.ID)

	env := CollectEnvironment(context.Background(), testCfg(), pluginstore.NewFakePluginStore(broken), refs)
	require.NotNil(t, env)
	require.LessOrEqual(t, len(env.Plugins[broken.ID].Error), 1024+len("…"),
		"environment.json is otherwise fixed-size; a plugin-authored error must not blow that up")
}

package resource

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/utils/ptr"
)

func hybridConfigManifest(versions ...app.ManifestVersion) *app.ManifestData {
	return &app.ManifestData{Group: "example.ext.grafana.app", Versions: versions}
}

func hybridConfigVersion(name string, hybrid *bool) app.ManifestVersion {
	return app.ManifestVersion{
		Name: name, Served: true,
		Kinds: []app.ManifestVersionKind{{
			Kind: "Widget", Scope: "Namespaced",
			Search: &app.ManifestVersionKindSearch{Hybrid: hybrid},
		}},
	}
}

func TestHybridSearchConfigRegistry_Versions(t *testing.T) {
	enabled := hybridConfigVersion("v1", ptr.To(true))
	disabled := hybridConfigVersion("v2", ptr.To(false))
	unserved := hybridConfigVersion("v3", ptr.To(true))
	unserved.Served = false
	cluster := hybridConfigVersion("v4", ptr.To(true))
	cluster.Kinds[0].Scope = "Cluster"
	absent := hybridConfigVersion("v5", nil)
	absent.Kinds[0].Search = nil

	for _, tt := range []struct {
		name     string
		versions []app.ManifestVersion
		want     bool
	}{
		{"one enabled served namespaced version suffices", []app.ManifestVersion{enabled, disabled}, true},
		{"unserved opt-in does not enable", []app.ManifestVersion{disabled, unserved}, false},
		{"cluster opt-in does not enable", []app.ManifestVersion{cluster}, false},
		{"missing search declaration does not enable", []app.ManifestVersion{absent}, false},
		{"missing hybrid declaration does not enable", []app.ManifestVersion{hybridConfigVersion("v1", nil)}, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			registry := NewHybridSearchConfigRegistry([]*app.ManifestData{nil, hybridConfigManifest(tt.versions...)})
			assert.Equal(t, tt.want, registry.Enabled("example.ext.grafana.app", "widgets"))
			assert.False(t, registry.Enabled("other.ext.grafana.app", "widgets"))
		})
	}
}

func TestHybridSearchConfigRegistry_Reload(t *testing.T) {
	enabled := hybridConfigManifest(hybridConfigVersion("v1", ptr.To(true)))
	disabled := hybridConfigManifest(hybridConfigVersion("v2", ptr.To(false)))
	absent := hybridConfigManifest(hybridConfigVersion("v2", nil))
	absent.Versions[0].Kinds[0].Search = nil
	registry := NewHybridSearchConfigRegistry([]*app.ManifestData{enabled})
	require.True(t, registry.Enabled(enabled.Group, "widgets"))

	for _, tt := range []struct {
		name    string
		sources [][]*app.ManifestData
		want    bool
	}{
		{"live opt-out overrides all builtin versions", [][]*app.ManifestData{{enabled}, {disabled}}, false},
		{"live missing declaration overrides builtin", [][]*app.ManifestData{{enabled}, {absent}}, false},
		{"first manifest wins ties", [][]*app.ManifestData{{disabled, enabled}}, false},
		{"live declaration enables", [][]*app.ManifestData{{disabled}, {enabled}}, true},
		{"removal clears live-only resource", nil, false},
		{"builtin is used after live override removed", [][]*app.ManifestData{{enabled}, nil}, true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			registry.Reload(tt.sources...)
			assert.Equal(t, tt.want, registry.Enabled(enabled.Group, "widgets"))
		})
	}
	assert.False(t, (*HybridSearchConfigRegistry)(nil).Enabled(enabled.Group, "widgets"))
}

func TestReloadManifests_HybridOptOutSurvivesInvalidSearchFields(t *testing.T) {
	enabled := hybridConfigManifest(hybridConfigVersion("v1", ptr.To(true)))
	disabled := hybridConfigManifest(hybridConfigVersion("v1", ptr.To(false)))
	disabled.Versions[0].Kinds[0].SearchFields = []app.ManifestVersionKindSearchField{{
		Name: "value", Path: "spec.value", Type: "int64", Capabilities: []string{"text"},
	}}
	options := SearchOptions{
		HybridSearchConfig: NewHybridSearchConfigRegistry([]*app.ManifestData{enabled}),
		SearchFields:       NewSearchFieldsRegistry(nil, nil, nil),
	}
	require.True(t, options.HybridSearchConfig.Enabled(enabled.Group, "widgets"))
	require.Error(t, options.ReloadManifests([]*app.ManifestData{enabled}, []*app.ManifestData{disabled}))
	assert.False(t, options.HybridSearchConfig.Enabled(enabled.Group, "widgets"))
}

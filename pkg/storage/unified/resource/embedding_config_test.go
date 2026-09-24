package resource

import (
	"fmt"
	"sync"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func embeddingTestManifest(revision int, versions ...app.ManifestVersion) *app.ManifestData {
	return &app.ManifestData{
		Group:    "widgets.example.test",
		Embed:    map[string]app.ManifestResourceEmbed{"widgets": {ReembedVersion: revision}},
		Versions: versions,
	}
}

func embeddingTestVersion(version string, fields ...app.ManifestVersionKindEmbedField) app.ManifestVersion {
	return app.ManifestVersion{
		Name:   version,
		Served: true,
		Kinds: []app.ManifestVersionKind{{
			Kind:  "Widget",
			Embed: &app.ManifestVersionKindEmbed{Fields: fields},
		}},
	}
}

func embeddingTestGVR(version, resource string) schema.GroupVersionResource {
	return schema.GroupVersionResource{Group: "widgets.example.test", Version: version, Resource: resource}
}

func TestEmbeddingConfigRegistry_ExactVersion(t *testing.T) {
	v1Fields := []app.ManifestVersionKindEmbedField{{Name: "title", Path: "spec.title"}}
	v2Fields := []app.ManifestVersionKindEmbedField{
		{Name: "section (text)", Path: "spec.summary"},
		{Name: "section (text)", Path: "spec.details.title"},
	}
	v1 := embeddingTestVersion("v1", v1Fields...)
	v1.Served = false
	v2 := embeddingTestVersion("v2", v2Fields...)
	for _, tt := range []struct {
		name      string
		preferred string
		versions  []app.ManifestVersion
	}{
		{name: "unserved version is preferred", preferred: "v1", versions: []app.ManifestVersion{v2, v1}},
		{name: "served version is preferred", preferred: "v2", versions: []app.ManifestVersion{v1, v2}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			manifest := embeddingTestManifest(7, tt.versions...)
			manifest.PreferredVersion = tt.preferred
			registry := NewEmbeddingConfigRegistry([]*app.ManifestData{manifest})

			for version, fields := range map[string][]app.ManifestVersionKindEmbedField{"v1": v1Fields, "v2": v2Fields} {
				got, ok := registry.For(embeddingTestGVR(version, "widgets"))
				require.True(t, ok, version)
				assert.Equal(t, EmbeddingConfig{ReembedVersion: 7, Fields: fields}, got)
			}
			for _, gvr := range []schema.GroupVersionResource{
				embeddingTestGVR("v3", "widgets"),
				embeddingTestGVR("", "widgets"),
				embeddingTestGVR("v1", "other"),
				{Group: "other.example.test", Version: "v1", Resource: "widgets"},
			} {
				_, ok := registry.For(gvr)
				assert.False(t, ok, gvr.String())
			}
		})
	}
}

func TestEmbeddingConfigRegistry_AbsentAndEmpty(t *testing.T) {
	manifest := &app.ManifestData{
		Group: "widgets.example.test",
		Embed: map[string]app.ManifestResourceEmbed{
			"gadgets": {ReembedVersion: 2},
			"notes":   {ReembedVersion: 2},
			"entries": {ReembedVersion: 2},
		},
		Versions: []app.ManifestVersion{{
			Name: "v1",
			Kinds: []app.ManifestVersionKind{
				{Kind: "Widget"},
				{Kind: "Gadget"},
				{Kind: "Note", Embed: &app.ManifestVersionKindEmbed{}},
				{Kind: "Entry", Plural: "entries", Embed: &app.ManifestVersionKindEmbed{Fields: []app.ManifestVersionKindEmbedField{}}},
			},
		}},
	}
	registry := NewEmbeddingConfigRegistry([]*app.ManifestData{nil, manifest})

	for _, tt := range []struct {
		name     string
		resource string
		present  bool
	}{
		{name: "custom builder omits both declarations", resource: "widgets"},
		{name: "root revision alone has no versioned config", resource: "gadgets"},
		{name: "explicit embed with nil fields", resource: "notes", present: true},
		{name: "explicit embed with empty fields", resource: "entries", present: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := registry.For(embeddingTestGVR("v1", tt.resource))
			require.Equal(t, tt.present, ok)
			if ok {
				assert.Equal(t, 2, got.ReembedVersion)
				assert.Empty(t, got.Fields)
			}
		})
	}
}

func TestEmbeddingConfigRegistry_ResourcePrecedence(t *testing.T) {
	oldFields := []app.ManifestVersionKindEmbedField{{Name: "title", Path: "spec.oldTitle"}}
	newFields := []app.ManifestVersionKindEmbedField{{Name: "title", Path: "spec.newTitle"}}
	builtin := embeddingTestManifest(3, embeddingTestVersion("v1", oldFields...), embeddingTestVersion("v2", oldFields...))
	builtin.Embed["gadgets"] = app.ManifestResourceEmbed{ReembedVersion: 5}
	builtin.Versions[0].Kinds = append(builtin.Versions[0].Kinds, app.ManifestVersionKind{
		Kind: "Gadget", Embed: &app.ManifestVersionKindEmbed{Fields: oldFields},
	})
	live := embeddingTestManifest(8, embeddingTestVersion("v2", newFields...))
	rootOnly := embeddingTestManifest(9, app.ManifestVersion{Name: "v2", Kinds: []app.ManifestVersionKind{{Kind: "Widget"}}})
	noEmbed := &app.ManifestData{Group: builtin.Group, Versions: rootOnly.Versions}
	noEmbed.Versions[0].Kinds[0].SearchFields = []app.ManifestVersionKindSearchField{
		{Name: "title", Path: "spec.title", Type: "string", Capabilities: []string{"filter"}},
	}
	oldConfig := EmbeddingConfig{ReembedVersion: 3, Fields: oldFields}
	for _, tt := range []struct {
		name    string
		sources [][]*app.ManifestData
		want    map[string]EmbeddingConfig
	}{
		{
			name:    "later source replaces revision and all versions",
			sources: [][]*app.ManifestData{{builtin}, {live}},
			want:    map[string]EmbeddingConfig{"v2": {ReembedVersion: 8, Fields: newFields}},
		},
		{
			name:    "first manifest within a source wins",
			sources: [][]*app.ManifestData{{builtin, live}},
			want:    map[string]EmbeddingConfig{"v1": oldConfig, "v2": oldConfig},
		},
		{
			name:    "root-only winner removes losing version fields",
			sources: [][]*app.ManifestData{{builtin}, {rootOnly}},
		},
		{
			name:    "higher source with search fields alone does not claim resource",
			sources: [][]*app.ManifestData{{builtin}, {noEmbed}},
			want:    map[string]EmbeddingConfig{"v1": oldConfig, "v2": oldConfig},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			registry := NewEmbeddingConfigRegistry(tt.sources...)
			for _, version := range []string{"v1", "v2"} {
				got, ok := registry.For(embeddingTestGVR(version, "widgets"))
				want, present := tt.want[version]
				require.Equal(t, present, ok, version)
				if present {
					assert.Equal(t, want, got)
				}
			}
			gadget, ok := registry.For(embeddingTestGVR("v1", "gadgets"))
			require.True(t, ok)
			assert.Equal(t, EmbeddingConfig{ReembedVersion: 5, Fields: oldFields}, gadget)
		})
	}
}

func TestEmbeddingConfigRegistry_Reload(t *testing.T) {
	oldFields := []app.ManifestVersionKindEmbedField{{Name: "title", Path: "spec.title"}}
	initial := embeddingTestManifest(1, embeddingTestVersion("v1", oldFields...))
	registry := NewEmbeddingConfigRegistry([]*app.ManifestData{initial})

	newFields := []app.ManifestVersionKindEmbedField{{Name: "body", Path: "spec.body"}}
	replacement := embeddingTestManifest(2, embeddingTestVersion("v2", newFields...))
	replacement.Embed["zebras"] = app.ManifestResourceEmbed{ReembedVersion: 6}
	replacement.Versions[0].Kinds = append(replacement.Versions[0].Kinds, app.ManifestVersionKind{
		Kind: "Zebra", Embed: &app.ManifestVersionKindEmbed{Fields: newFields},
	})
	got, ok := registry.For(embeddingTestGVR("v1", "widgets"))
	require.True(t, ok)
	assert.Equal(t, EmbeddingConfig{ReembedVersion: 1, Fields: oldFields}, got)

	registry.Reload([]*app.ManifestData{replacement})
	_, ok = registry.For(embeddingTestGVR("v1", "widgets"))
	assert.False(t, ok)
	got, ok = registry.For(embeddingTestGVR("v2", "widgets"))
	require.True(t, ok)
	assert.Equal(t, EmbeddingConfig{ReembedVersion: 2, Fields: newFields}, got)
	got, ok = registry.For(embeddingTestGVR("v2", "zebras"))
	require.True(t, ok)
	assert.Equal(t, 6, got.ReembedVersion)

	registry.Reload()
	_, ok = registry.For(embeddingTestGVR("v2", "widgets"))
	assert.False(t, ok)
	_, ok = registry.For(embeddingTestGVR("v2", "zebras"))
	assert.False(t, ok)
}

func TestEmbeddingConfigRegistry_CopiesInputsAndResults(t *testing.T) {
	field := app.ManifestVersionKindEmbedField{Name: "title", Path: "spec.title"}
	manifest := embeddingTestManifest(1, embeddingTestVersion("v1", field))
	registry := NewEmbeddingConfigRegistry([]*app.ManifestData{manifest})
	manifest.Embed["widgets"] = app.ManifestResourceEmbed{ReembedVersion: 99}
	manifest.Versions[0].Kinds[0].Embed.Fields[0].Path = "spec.changed"

	got, ok := registry.For(embeddingTestGVR("v1", "widgets"))
	require.True(t, ok)
	want := EmbeddingConfig{ReembedVersion: 1, Fields: []app.ManifestVersionKindEmbedField{field}}
	require.Equal(t, want, got)
	got.Fields[0].Name = "changed"
	got.Fields[0].Path = "spec.changedAgain"

	again, ok := registry.For(embeddingTestGVR("v1", "widgets"))
	require.True(t, ok)
	assert.Equal(t, want, again)
}

func TestEmbeddingConfigRegistry_SnapshotCopies(t *testing.T) {
	field := app.ManifestVersionKindEmbedField{Name: "title", Path: "spec.title"}
	registry := NewEmbeddingConfigRegistry([]*app.ManifestData{embeddingTestManifest(1,
		embeddingTestVersion("v1", field), embeddingTestVersion("v2"))})
	snapshot := registry.Snapshot()
	require.Len(t, snapshot, 2)
	gvr := embeddingTestGVR("v1", "widgets")
	snapshot[gvr].Fields[0].Path = "spec.changed"
	delete(snapshot, embeddingTestGVR("v2", "widgets"))
	current := registry.Snapshot()
	require.Len(t, current, 2)
	assert.Equal(t, []app.ManifestVersionKindEmbedField{field}, current[gvr].Fields)
	assert.Nil(t, current[embeddingTestGVR("v2", "widgets")].Fields)
	registry.Reload()
	assert.Empty(t, registry.Snapshot())
	assert.Len(t, current, 2)
}

func TestEmbeddingConfigRegistry_SnapshotConsistentDuringReload(t *testing.T) {
	manifest := func(revision int) *app.ManifestData {
		field := app.ManifestVersionKindEmbedField{Name: fmt.Sprint(revision), Path: "spec.title"}
		return embeddingTestManifest(revision, embeddingTestVersion("v1", field), embeddingTestVersion("v2", field))
	}
	registry := NewEmbeddingConfigRegistry([]*app.ManifestData{manifest(1)})
	var writer sync.WaitGroup
	writer.Add(1)
	go func() {
		defer writer.Done()
		for revision := 2; revision < 100; revision++ {
			registry.Reload([]*app.ManifestData{manifest(revision)})
		}
	}()
	defer writer.Wait()
	for range 100 {
		snapshot := registry.Snapshot()
		require.Len(t, snapshot, 2)
		v1 := snapshot[embeddingTestGVR("v1", "widgets")]
		assert.Equal(t, v1, snapshot[embeddingTestGVR("v2", "widgets")])
		require.Len(t, v1.Fields, 1)
		assert.Equal(t, fmt.Sprint(v1.ReembedVersion), v1.Fields[0].Name)
	}
}

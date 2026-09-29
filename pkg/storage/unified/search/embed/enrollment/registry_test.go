package enrollment

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/generic"
)

func testManifest(group, plural string, revision int, versions map[string][]app.ManifestVersionKindEmbedField) *app.ManifestData {
	m := &app.ManifestData{
		Group: group,
		Embed: map[string]app.ManifestResourceEmbed{plural: {ReembedVersion: revision}},
	}
	for version, fields := range versions {
		m.Versions = append(m.Versions, app.ManifestVersion{
			Name: version,
			Kinds: []app.ManifestVersionKind{{
				Kind: "Widget", Plural: plural, Embed: &app.ManifestVersionKindEmbed{Fields: fields},
			}},
		})
	}
	return m
}

func TestRegistrySelection(t *testing.T) {
	fields := []app.ManifestVersionKindEmbedField{{Name: "title", Path: "spec.title"}}
	configs := resource.NewEmbeddingConfigRegistry([]*app.ManifestData{
		testManifest("widgets.example.test", "widgets", 5, map[string][]app.ManifestVersionKindEmbedField{"v1": fields}),
		testManifest("dashboard.grafana.app", "dashboards", 99, map[string][]app.ManifestVersionKindEmbedField{"v1": fields}),
	})
	custom := dashboard.New()
	for _, tt := range []struct {
		name    string
		allowed []string
		want    []string
	}{
		{name: "empty enrolls nothing"},
		{name: "dashboard default is supplied by config", allowed: []string{"dashboard.grafana.app/dashboards"}, want: []string{"dashboard.grafana.app/dashboards"}},
		{name: "generic only", allowed: []string{"widgets.example.test/widgets"}, want: []string{"widgets.example.test/widgets"}},
		{name: "sorted deduplicated selection", allowed: []string{"widgets.example.test/widgets", " dashboard.grafana.app/dashboards ", "", "widgets.example.test/widgets"}, want: []string{"dashboard.grafana.app/dashboards", "widgets.example.test/widgets"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			registry, err := New(configs, tt.allowed, []embed.Builder{custom}, nil)
			require.NoError(t, err)
			require.NoError(t, registry.Validate())
			snapshot := registry.Snapshot()
			builders := snapshot.Builders()
			var got []string
			for _, b := range builders {
				assert.True(t, snapshot.Has(b.Group(), b.Resource()))
				got = append(got, b.Group()+"/"+b.Resource())
				if b.Resource() == "dashboards" {
					assert.Same(t, custom, b)
					assert.Equal(t, custom.Version(), b.Version())
				} else {
					assert.IsType(t, &generic.Builder{}, b)
					assert.Equal(t, 5, b.Version())
				}
			}
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestRegistryValidatesConfiguration(t *testing.T) {
	for _, entry := range []string{"dashboards", "/dashboards", "dashboard.grafana.app/", "group/widgets/extra", "group /widgets", "group/wid gets"} {
		t.Run(entry, func(t *testing.T) {
			_, err := New(nil, []string{entry}, nil, nil)
			require.ErrorContains(t, err, "expected group/resource")
		})
	}
	_, err := New(nil, nil, []embed.Builder{dashboard.New(), dashboard.New()}, nil)
	require.ErrorContains(t, err, "duplicate custom embedding builder")
	_, err = New(nil, nil, []embed.Builder{nil}, nil)
	require.ErrorContains(t, err, "must not be nil")
	_, err = New(nil, nil, []embed.Builder{&testCustomBuilder{group: "group"}}, nil)
	require.ErrorContains(t, err, "custom embedding builder")
}

func TestRegistryDefersUnsupportedUntilValidation(t *testing.T) {
	configs := resource.NewEmbeddingConfigRegistry([]*app.ManifestData{
		testManifest("widgets.example.test", "widgets", 3, nil),
	})
	registry, err := New(configs, []string{"widgets.example.test/widgets"}, nil, nil)
	require.NoError(t, err)
	require.ErrorContains(t, registry.Validate(), "widgets.example.test/widgets has no custom builder or manifest embedding declaration")
	assert.Empty(t, registry.Snapshot().Builders(), "root revision alone has no versioned declaration")
	assert.False(t, registry.Has("widgets.example.test", "widgets"))

	configs.Reload([]*app.ManifestData{testManifest("widgets.example.test", "widgets", 3, map[string][]app.ManifestVersionKindEmbedField{"v1": {}})})
	require.NoError(t, registry.Validate())
	assert.True(t, registry.Has("widgets.example.test", "widgets"), "an explicitly empty version declaration is enrolled")
	builders := registry.Snapshot().Builders()
	require.Len(t, builders, 1)
	items, err := extract(t, builders[0], "v1", nil)
	require.NoError(t, err)
	assert.Empty(t, items)
}

func TestRegistryCustomNeedsNoDeclaration(t *testing.T) {
	custom := dashboard.New()
	registry, err := New(nil, []string{"dashboard.grafana.app/dashboards"}, []embed.Builder{custom}, nil)
	require.NoError(t, err)
	require.NoError(t, registry.Validate())
	builders := registry.Snapshot().Builders()
	require.Len(t, builders, 1)
	assert.Same(t, custom, builders[0])
	assert.True(t, registry.Has(custom.Group(), custom.Resource()))
}

func TestRegistrySnapshotsIsolateRemovedDeclarations(t *testing.T) {
	manifests := []*app.ManifestData{
		testManifest("widgets.example.test", "widgets", 3, map[string][]app.ManifestVersionKindEmbedField{"v1": {}}),
		testManifest("widgets.example.test", "gadgets", 3, map[string][]app.ManifestVersionKindEmbedField{"v1": {}}),
		testManifest("widgets.example.test", "excluded", 3, map[string][]app.ManifestVersionKindEmbedField{"v1": {}}),
	}
	configs := resource.NewEmbeddingConfigRegistry(manifests)
	registry, err := New(configs, []string{"dashboard.grafana.app/dashboards", "widgets.example.test/widgets", "widgets.example.test/gadgets"}, []embed.Builder{
		dashboard.New(), &testCustomBuilder{group: "widgets.example.test", resource: "custom"},
	}, nil)
	require.NoError(t, err)
	require.NoError(t, registry.Validate())
	initial := registry.Snapshot()
	require.Len(t, initial.Builders(), 3)
	assert.True(t, initial.Has("dashboard.grafana.app", "dashboards"))
	assert.True(t, initial.Has("widgets.example.test", "widgets"))
	assert.False(t, initial.Has("widgets.example.test", "excluded"), "declarations must also be allowlisted")
	assert.False(t, initial.Has("widgets.example.test", "custom"), "custom builders must also be allowlisted")
	assert.False(t, initial.Has("other.example.test", "widgets"))
	assert.True(t, registry.Has("dashboard.grafana.app", "dashboards"))
	assert.True(t, registry.Has("widgets.example.test", "widgets"))
	assert.False(t, registry.Has("widgets.example.test", "excluded"))
	assert.False(t, registry.Has("widgets.example.test", "custom"))
	assert.False(t, registry.Has("other.example.test", "widgets"))

	configs.Reload(manifests[1:])
	removed := registry.Snapshot()
	assert.False(t, removed.Has("widgets.example.test", "widgets"))
	assert.False(t, registry.Has("widgets.example.test", "widgets"))
	assert.True(t, registry.Has("dashboard.grafana.app", "dashboards"))
	assert.True(t, registry.Has("widgets.example.test", "gadgets"))
	builders := removed.Builders()
	require.Len(t, builders, 2)
	assert.Equal(t, "dashboards", builders[0].Resource())
	assert.Equal(t, "gadgets", builders[1].Resource())
	for _, builder := range builders {
		assert.True(t, removed.Has(builder.Group(), builder.Resource()))
	}
	assert.True(t, initial.Has("widgets.example.test", "widgets"))
	assert.Len(t, initial.Builders(), 3)
	require.ErrorContains(t, registry.Validate(), "widgets.example.test/widgets has no custom builder or manifest embedding declaration")

	configs.Reload(manifests)
	restored := registry.Snapshot()
	assert.True(t, restored.Has("widgets.example.test", "widgets"))
	assert.True(t, registry.Has("widgets.example.test", "widgets"))
	assert.Len(t, restored.Builders(), 3)
	assert.False(t, removed.Has("widgets.example.test", "widgets"))
	assert.Len(t, removed.Builders(), 2)
	require.NoError(t, registry.Validate())
}

func TestRegistryReloadsImmutableBuilders(t *testing.T) {
	initial := testManifest("widgets.example.test", "widgets", 3, map[string][]app.ManifestVersionKindEmbedField{
		"v1": {{Name: "old", Path: "spec.old"}},
		"v2": {{Name: "new", Path: "spec.new"}},
	})
	configs := resource.NewEmbeddingConfigRegistry([]*app.ManifestData{initial})
	allowed := []string{"widgets.example.test/widgets"}
	skips := prometheus.NewCounterVec(prometheus.CounterOpts{Name: "enrollment_skipped_versions_total"}, []string{"group", "resource", "version"})
	registry, err := New(configs, allowed, nil, skips)
	require.NoError(t, err)
	allowed[0] = "other.example.test/other"
	oldBuilders := registry.Snapshot().Builders()
	require.Len(t, oldBuilders, 1)
	old := oldBuilders[0]
	spec := map[string]any{"old": "first", "new": "second", "latest": "third"}
	items, err := extract(t, old, "v1", spec)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, "old: first", items[0].Content)
	items, err = extract(t, old, "v2", spec)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, "new: second", items[0].Content)

	// A field change must be observed even when its revision is unchanged.
	replacement := testManifest("widgets.example.test", "widgets", 3, map[string][]app.ManifestVersionKindEmbedField{"v2": {{Name: "latest", Path: "spec.latest"}}})
	configs.Reload([]*app.ManifestData{replacement})
	changed := registry.Snapshot().Builders()
	require.Len(t, changed, 1)
	items, err = extract(t, changed[0], "v2", spec)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, "latest: third", items[0].Content)
	_, err = extract(t, changed[0], "v1", spec)
	require.ErrorIs(t, err, embed.ErrSkip)
	assert.Equal(t, float64(1), testutil.ToFloat64(skips.WithLabelValues("widgets.example.test", "widgets", "v1")))

	replacement.Embed["widgets"] = app.ManifestResourceEmbed{ReembedVersion: 4}
	configs.Reload([]*app.ManifestData{replacement})
	newBuilders := registry.Snapshot().Builders()
	require.Len(t, newBuilders, 1)
	assert.Equal(t, 4, newBuilders[0].Version())
	assert.Equal(t, 3, old.Version())
	items, err = extract(t, old, "v2", spec)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, "new: second", items[0].Content)

	configs.Reload()
	assert.Empty(t, registry.Snapshot().Builders())
}

func TestRegistryPartitionValidation(t *testing.T) {
	for _, tt := range []struct {
		name      string
		resources []string
		groups    []string
		wantError string
	}{
		{name: "same resource across groups", resources: []string{"widgets", "widgets"}, groups: []string{"a.test", "b.test"}, wantError: "same partition key"},
		{name: "sanitized alias", resources: []string{"foo-bar", "foo_bar"}, groups: []string{"a.test", "b.test"}, wantError: "same partition key"},
		{name: "reserved external suffix", resources: []string{"widgets-external"}, groups: []string{"a.test"}, wantError: "reserved partition key"},
		{name: "partition too long", resources: []string{strings.Repeat("a", 40)}, groups: []string{"a.test"}, wantError: "too long"},
		{name: "logical resource preserved", resources: []string{"foo-bar"}, groups: []string{"a.test"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			allowed := make([]string, 0, len(tt.resources))
			custom := make([]embed.Builder, 0, len(tt.resources))
			for i, name := range tt.resources {
				allowed = append(allowed, tt.groups[i]+"/"+name)
				custom = append(custom, &testCustomBuilder{group: tt.groups[i], resource: name})
			}
			registry, err := New(nil, allowed, custom, nil)
			require.NoError(t, err)
			err = registry.Validate()
			if tt.wantError != "" {
				require.ErrorContains(t, err, tt.wantError)
				return
			}
			require.NoError(t, err)
			builders := registry.Snapshot().Builders()
			require.Len(t, builders, 1)
			assert.Equal(t, tt.resources[0], builders[0].Resource())
		})
	}
	registry, err := New(nil, []string{"a.test/widgets"}, []embed.Builder{
		&testCustomBuilder{group: "a.test", resource: "widgets"},
		&testCustomBuilder{group: "b.test", resource: "widgets"},
	}, nil)
	require.NoError(t, err)
	require.NoError(t, registry.Validate())
	builders := registry.Snapshot().Builders()
	require.Len(t, builders, 1, "unselected resources do not collide")
}

func TestBuilderSnapshotCopiesBuilderLists(t *testing.T) {
	custom := dashboard.New()
	builders := []embed.Builder{custom}
	snapshot := embed.NewBuilderSnapshot(builders)
	builders[0] = &testCustomBuilder{group: "other.test", resource: "widgets"}
	returned := snapshot.Builders()
	returned[0] = nil

	require.Equal(t, []embed.Builder{custom}, snapshot.Builders())
	assert.True(t, snapshot.Has(custom.Group(), custom.Resource()))
	assert.False(t, snapshot.Has("other.test", "widgets"))
}

func extract(t *testing.T, builder embed.Builder, version string, spec map[string]any) ([]embed.Item, error) {
	t.Helper()
	value, err := json.Marshal(map[string]any{"apiVersion": builder.Group() + "/" + version, "spec": spec})
	require.NoError(t, err)
	return builder.Extract(context.Background(), &resourcepb.ResourceKey{Group: builder.Group(), Resource: builder.Resource(), Name: "one"}, value, "")
}

type testCustomBuilder struct {
	group, resource string
}

func (b *testCustomBuilder) Group() string            { return b.group }
func (b *testCustomBuilder) Resource() string         { return b.resource }
func (b *testCustomBuilder) MaxItemsPerResource() int { return 1 }
func (b *testCustomBuilder) Version() int             { return 1 }
func (b *testCustomBuilder) Extract(context.Context, *resourcepb.ResourceKey, []byte, string) ([]embed.Item, error) {
	return nil, nil
}

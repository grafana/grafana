package pluginstore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
)

func testStoreWithAliases() *FakePluginStore {
	return NewFakePluginStore(
		Plugin{JSONData: plugins.JSONData{ID: "grafana-pyroscope-datasource", AliasIDs: []string{"phlare"}}},
		Plugin{JSONData: plugins.JSONData{ID: "grafana-testdata-datasource", AliasIDs: []string{"testdata"}}},
		Plugin{JSONData: plugins.JSONData{ID: "loki"}},
	)
}

func TestCanonicalPluginID(t *testing.T) {
	store := testStoreWithAliases()

	tests := []struct {
		name      string
		store     Store
		idOrAlias string
		expected  string
	}{
		{name: "alias resolves to canonical ID", store: store, idOrAlias: "phlare", expected: "grafana-pyroscope-datasource"},
		{name: "canonical ID is returned unchanged", store: store, idOrAlias: "grafana-pyroscope-datasource", expected: "grafana-pyroscope-datasource"},
		{name: "plugin without aliases is returned unchanged", store: store, idOrAlias: "loki", expected: "loki"},
		{name: "unknown ID is returned unchanged", store: store, idOrAlias: "does-not-exist", expected: "does-not-exist"},
		{name: "empty ID is returned unchanged", store: store, idOrAlias: "", expected: ""},
		{name: "nil store returns input unchanged", store: nil, idOrAlias: "phlare", expected: "phlare"},
		{name: "empty store returns input unchanged", store: NewFakePluginStore(), idOrAlias: "phlare", expected: "phlare"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, CanonicalPluginID(context.Background(), tt.store, tt.idOrAlias))
		})
	}
}

func TestSamePlugin(t *testing.T) {
	store := testStoreWithAliases()

	tests := []struct {
		name     string
		store    Store
		a        string
		b        string
		expected bool
	}{
		{name: "identical IDs", store: store, a: "loki", b: "loki", expected: true},
		{name: "alias and canonical ID", store: store, a: "phlare", b: "grafana-pyroscope-datasource", expected: true},
		{name: "canonical ID and alias", store: store, a: "grafana-pyroscope-datasource", b: "phlare", expected: true},
		{name: "second plugin's alias and canonical ID", store: store, a: "testdata", b: "grafana-testdata-datasource", expected: true},
		{name: "aliases of different plugins", store: store, a: "phlare", b: "testdata", expected: false},
		{name: "unrelated plugins", store: store, a: "phlare", b: "loki", expected: false},
		{name: "unknown ID only matches itself", store: store, a: "loki", b: "does-not-exist", expected: false},
		{name: "nil store still matches identical IDs", store: nil, a: "phlare", b: "phlare", expected: true},
		{name: "nil store cannot resolve aliases", store: nil, a: "phlare", b: "grafana-pyroscope-datasource", expected: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, SamePlugin(context.Background(), tt.store, tt.a, tt.b))
		})
	}
}

// Without this the fake disagrees with the real registry on exactly the renamed-plugin case
// these helpers exist for.
func TestFakePluginStore_PrefersIDsOverAliases(t *testing.T) {
	store := NewFakePluginStore(
		Plugin{JSONData: plugins.JSONData{ID: "grafana-pyroscope-datasource", AliasIDs: []string{"phlare"}}},
		Plugin{JSONData: plugins.JSONData{ID: "phlare"}},
	)

	p, exists := store.Plugin(context.Background(), "phlare")
	require.True(t, exists)
	require.Equal(t, "phlare", p.ID)

	p, exists = store.Plugin(context.Background(), "grafana-pyroscope-datasource")
	require.True(t, exists)
	require.Equal(t, "grafana-pyroscope-datasource", p.ID)
}

func TestFakePluginStore_ResolvesAliases(t *testing.T) {
	store := testStoreWithAliases()

	p, exists := store.Plugin(context.Background(), "phlare")
	require.True(t, exists)
	require.Equal(t, "grafana-pyroscope-datasource", p.ID)

	_, exists = store.Plugin(context.Background(), "does-not-exist")
	require.False(t, exists)
}

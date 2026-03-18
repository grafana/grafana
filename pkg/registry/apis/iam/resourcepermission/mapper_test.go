package resourcepermission

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// --- NewMappersRegistry defaults ---

func TestNewMappersRegistry_Defaults(t *testing.T) {
	m := NewMappersRegistry()

	folderGR := schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
	dashGR := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}

	t.Run("folders mapper is registered and enabled", func(t *testing.T) {
		_, ok := m.Get(folderGR)
		assert.True(t, ok)
		assert.True(t, m.IsEnabled(folderGR))
	})

	t.Run("dashboards mapper is registered and enabled", func(t *testing.T) {
		_, ok := m.Get(dashGR)
		assert.True(t, ok)
		assert.True(t, m.IsEnabled(dashGR))
	})

	t.Run("unknown group/resource returns not found", func(t *testing.T) {
		_, ok := m.Get(schema.GroupResource{Group: "other.grafana.app", Resource: "other"})
		assert.False(t, ok)
		assert.False(t, m.IsEnabled(schema.GroupResource{Group: "other.grafana.app", Resource: "other"}))
	})
}

// --- RegisterMapper ---

func TestMappersRegistry_RegisterMapper(t *testing.T) {
	t.Run("nil enabled func is always enabled", func(t *testing.T) {
		m := NewMappersRegistry()
		gr := schema.GroupResource{Group: "datasource.grafana.app", Resource: "datasources"}
		m.RegisterMapper(gr, NewMapper("datasources", []string{"query"}), nil)

		_, ok := m.Get(gr)
		assert.True(t, ok)
		assert.True(t, m.IsEnabled(gr))
	})

	t.Run("disabled mapper is Get-able but not IsEnabled", func(t *testing.T) {
		m := NewMappersRegistry()
		gr := schema.GroupResource{Group: "loki.datasource.grafana.app", Resource: "datasources"}
		m.RegisterMapper(gr, NewMapper("datasources", []string{"query"}), func() bool { return false })

		_, ok := m.Get(gr)
		assert.True(t, ok, "Get should succeed regardless of enabled state")
		assert.False(t, m.IsEnabled(gr))
	})

	t.Run("disabled mapper is excluded from EnabledScopePatterns and EnabledActionSets", func(t *testing.T) {
		m := NewMappersRegistry()
		gr := schema.GroupResource{Group: "loki.datasource.grafana.app", Resource: "datasources"}
		m.RegisterMapper(gr, NewMapper("datasources", []string{"query"}), func() bool { return false })

		for _, p := range m.EnabledScopePatterns() {
			assert.NotEqual(t, "datasources:uid:%", p)
		}
		for _, a := range m.EnabledActionSets() {
			assert.NotEqual(t, "datasources:query", a)
		}
	})
}

// --- ParseScope ---

func TestMappersRegistry_ParseScope(t *testing.T) {
	m := NewMappersRegistry()

	t.Run("parses folder scope", func(t *testing.T) {
		grn, err := m.ParseScope("folders:uid:fold1")
		require.NoError(t, err)
		assert.Equal(t, "folder.grafana.app", grn.Group)
		assert.Equal(t, "folders", grn.Resource)
		assert.Equal(t, "fold1", grn.Name)
	})

	t.Run("parses dashboard scope", func(t *testing.T) {
		grn, err := m.ParseScope("dashboards:uid:dash1")
		require.NoError(t, err)
		assert.Equal(t, "dashboard.grafana.app", grn.Group)
		assert.Equal(t, "dashboards", grn.Resource)
		assert.Equal(t, "dash1", grn.Name)
	})

	t.Run("parses dynamically registered datasource scope", func(t *testing.T) {
		m2 := NewMappersRegistry()
		gr := schema.GroupResource{Group: "datasource.grafana.app", Resource: "datasources"}
		m2.RegisterMapper(gr, NewMapper("datasources", []string{"query", "edit", "admin"}), nil)

		grn, err := m2.ParseScope("datasources:uid:abc")
		require.NoError(t, err)
		assert.Equal(t, "datasource.grafana.app", grn.Group)
		assert.Equal(t, "datasources", grn.Resource)
		assert.Equal(t, "abc", grn.Name)
	})

	t.Run("unknown scope prefix returns error", func(t *testing.T) {
		_, err := m.ParseScope("unknown:uid:x")
		assert.ErrorIs(t, err, errUnknownGroupResource)
	})

	t.Run("malformed scope (no colons) returns error", func(t *testing.T) {
		_, err := m.ParseScope("nocolons")
		assert.ErrorIs(t, err, errInvalidScope)
	})

	t.Run("only two parts returns error", func(t *testing.T) {
		_, err := m.ParseScope("folders:uid")
		assert.ErrorIs(t, err, errInvalidScope)
	})
}

// --- EnabledActionSets / EnabledScopePatterns ---

func TestMappersRegistry_EnabledFiltered(t *testing.T) {
	gr := schema.GroupResource{Group: "datasource.grafana.app", Resource: "datasources"}

	t.Run("enabled mapper contributes to both slices", func(t *testing.T) {
		m := NewMappersRegistry()
		m.RegisterMapper(gr, NewMapper("datasources", []string{"query", "edit"}), nil)

		assert.Contains(t, m.EnabledScopePatterns(), "datasources:uid:%")
		assert.Contains(t, m.EnabledActionSets(), "datasources:query")
		assert.Contains(t, m.EnabledActionSets(), "datasources:edit")
	})

	t.Run("disabled mapper is excluded from both slices", func(t *testing.T) {
		m := NewMappersRegistry()
		m.RegisterMapper(gr, NewMapper("datasources", []string{"query"}), func() bool { return false })

		assert.NotContains(t, m.EnabledScopePatterns(), "datasources:uid:%")
		assert.NotContains(t, m.EnabledActionSets(), "datasources:query")
	})

	t.Run("defaults always appear in both slices", func(t *testing.T) {
		m := NewMappersRegistry()
		patterns := m.EnabledScopePatterns()
		assert.Contains(t, patterns, "folders:uid:%")
		assert.Contains(t, patterns, "dashboards:uid:%")
		actions := m.EnabledActionSets()
		assert.Contains(t, actions, "folders:view")
		assert.Contains(t, actions, "dashboards:edit")
	})
}

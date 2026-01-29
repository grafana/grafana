package rbac

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test-only wildcard pattern; not used in the real mapper.
const testWildcardPattern = "*.test.grafana.app"

// TestMapperRegistry_DatasourceWildcard verifies the real mapper's *.datasource.grafana.app entry.
// Generic wildcard behavior (match + deny cases) is covered by TestMapperRegistry_WildcardGroup.
func TestMapperRegistry_DatasourceWildcard(t *testing.T) {
	reg := NewMapperRegistry()

	// Real config: groups matching *.datasource.grafana.app get the datasources mapping
	for _, group := range []string{"loki.datasource.grafana.app", "mimir.datasource.grafana.app"} {
		mapping, ok := reg.Get(group, "datasources")
		require.True(t, ok, "Get(%q, \"datasources\") should find mapping", group)
		require.NotNil(t, mapping)
		assert.Equal(t, "datasources:uid:", mapping.Prefix())
		all := reg.GetAll(group)
		require.Len(t, all, 1)
	}

	// Security: wildcard-matched group must not resolve to resources from other groups
	_, ok := reg.Get("loki.datasource.grafana.app", "dashboards")
	assert.False(t, ok, "Get(datasource group, \"dashboards\") must not return a mapping")
}

func TestGroupMatchesWildcard(t *testing.T) {
	tests := []struct {
		group   string
		pattern string
		want    bool
	}{
		{"foo.test.grafana.app", testWildcardPattern, true},
		{"bar.test.grafana.app", testWildcardPattern, true},
		{"baz.test.grafana.app", testWildcardPattern, true},
		{"dashboard.grafana.app", testWildcardPattern, false},
		{"test.grafana.app", testWildcardPattern, false},
		{"foo.test.grafana.app", "dashboard.grafana.app", false},
		{"", testWildcardPattern, false},
		{"foo.test.grafana.app", "*", false},
		{"*.test.grafana.app", testWildcardPattern, false},
	}
	for _, tt := range tests {
		t.Run(tt.group+"_"+tt.pattern, func(t *testing.T) {
			got := groupMatchesWildcard(tt.group, tt.pattern)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestMapperRegistry_WildcardGroup(t *testing.T) {
	// Test-only mapper with *.test.grafana.app; exercises full wildcard behavior (match + deny)
	tr := newResourceTranslation("testresources", "uid", false, nil)
	m := mapper{
		testWildcardPattern: {
			"testresources": tr,
		},
	}
	var reg MapperRegistry = m

	// Matching groups get the mapping
	for _, group := range []string{"foo.test.grafana.app", "bar.test.grafana.app", "baz.test.grafana.app"} {
		t.Run("matches_"+group, func(t *testing.T) {
			mapping, ok := reg.Get(group, "testresources")
			require.True(t, ok, "Get(%q, \"testresources\") should find mapping", group)
			require.NotNil(t, mapping)
			assert.Equal(t, "testresources:uid:", mapping.Prefix())
			all := reg.GetAll(group)
			require.Len(t, all, 1)
			assert.Equal(t, mapping.Prefix(), all[0].Prefix())
		})
	}

	// Wildcard as input, wrong suffix, no prefix, or unknown group must not resolve
	denyCases := []struct {
		name  string
		group string
	}{
		{"wildcard_input", testWildcardPattern},
		{"wrong_suffix", "foo.test.grafana.app.evil"},
		{"no_prefix", "test.grafana.app"},
		{"unknown_group", "unknown.grafana.app"},
	}
	for _, tc := range denyCases {
		t.Run("deny_"+tc.name, func(t *testing.T) {
			_, ok := reg.Get(tc.group, "testresources")
			assert.False(t, ok, "Get(%q) must not return a mapping", tc.group)
			all := reg.GetAll(tc.group)
			assert.Empty(t, all, "GetAll(%q) must not return any mappings", tc.group)
		})
	}
}

func TestMapperRegistry_ExactMatchPreferred(t *testing.T) {
	reg := NewMapperRegistry()

	// Exact group keys still work
	mapping, ok := reg.Get("dashboard.grafana.app", "dashboards")
	require.True(t, ok)
	require.NotNil(t, mapping)
	assert.Equal(t, "dashboards:uid:", mapping.Prefix())
}

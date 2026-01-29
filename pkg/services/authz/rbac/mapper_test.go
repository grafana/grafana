package rbac

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test-only wildcard pattern; not used in the real mapper.
const testWildcardPattern = "*.test.grafana.app"

func TestMapperRegistry_DatasourceWildcard_OnlyAllowedPrefixes(t *testing.T) {
	reg := NewMapperRegistry()

	allowedGroups := []string{"loki.datasource.grafana.app", "tempo.datasource.grafana.app", "prometheus.datasource.grafana.app"}
	for _, group := range allowedGroups {
		t.Run("allowed_"+group, func(t *testing.T) {
			mapping, ok := reg.Get(group, "datasources")
			require.True(t, ok, "Get(%q, \"datasources\") should find mapping", group)
			require.NotNil(t, mapping)
			assert.Equal(t, "datasources:uid:", mapping.Prefix())

			all := reg.GetAll(group)
			require.Len(t, all, 1, "GetAll(%q) should return datasources mapping", group)
		})
	}

	disallowedGroups := []string{"mimir.datasource.grafana.app", "influxdb.datasource.grafana.app", "foo.datasource.grafana.app"}
	for _, group := range disallowedGroups {
		t.Run("disallowed_"+group, func(t *testing.T) {
			_, ok := reg.Get(group, "datasources")
			assert.False(t, ok, "Get(%q, \"datasources\") must not return a mapping", group)

			all := reg.GetAll(group)
			assert.Empty(t, all, "GetAll(%q) must not return any mappings", group)
		})
	}
}

// TestMapperRegistry_DatasourceWildcard_SecurityNoBypass verifies that there is no way to gain
// affirmative access (Get or GetAll) for *.datasource.grafana.app except for the explicitly
// allowed prefixes (loki, tempo, prometheus). This is security-critical: only exact prefix
// matches must be allowed; no substring, case variation, or multi-segment bypass.
func TestMapperRegistry_DatasourceWildcard_SecurityNoBypass(t *testing.T) {
	reg := NewMapperRegistry()

	// Security: only exact allowed prefixes must grant access. These must all be denied.
	denyGroups := []struct {
		name   string
		group  string
		reason string
	}{
		{"wildcard_input", "*.datasource.grafana.app", "wildcard group as input must never resolve"},
		{"prefix_superset", "lokix.datasource.grafana.app", "prefix must be exact, not superset"},
		{"prefix_with_segment", "loki.foo.datasource.grafana.app", "prefix is multi-segment; only 'loki' allowed, not 'loki.foo'"},
		{"prefix_contains_allowed", "evil.loki.datasource.grafana.app", "prefix must equal allowed entry, not contain it"},
		{"case_variation_loki", "Loki.datasource.grafana.app", "prefix check is case-sensitive"},
		{"case_variation_tempo", "TEMPO.datasource.grafana.app", "prefix check is case-sensitive"},
		{"empty_prefix", "datasource.grafana.app", "no prefix (suffix-only) must not match"},
		{"wrong_suffix", "loki.datasource.grafana.app.evil", "suffix must match exactly"},
	}

	for _, tc := range denyGroups {
		t.Run(tc.name, func(t *testing.T) {
			_, ok := reg.Get(tc.group, "datasources")
			assert.False(t, ok, "Get: %s (group=%q)", tc.reason, tc.group)

			all := reg.GetAll(tc.group)
			assert.Empty(t, all, "GetAll: %s (group=%q)", tc.reason, tc.group)
		})
	}
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
	// Use a test-only mapper with *.test.grafana.app (not the real *.datasource.grafana.app)
	tr := newResourceTranslation("testresources", "uid", false, nil)
	m := mapper{
		testWildcardPattern: {
			"testresources": tr,
		},
	}
	var reg MapperRegistry = m

	groups := []string{"foo.test.grafana.app", "bar.test.grafana.app", "baz.test.grafana.app"}
	for _, group := range groups {
		t.Run(group, func(t *testing.T) {
			mapping, ok := reg.Get(group, "testresources")
			require.True(t, ok, "Get(%q, \"testresources\") should find mapping", group)
			require.NotNil(t, mapping)
			assert.Equal(t, "testresources:uid:", mapping.Prefix())

			all := reg.GetAll(group)
			require.Len(t, all, 1)
			assert.Equal(t, mapping.Prefix(), all[0].Prefix())
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

func TestMapperRegistry_DisallowsWildcardGroups(t *testing.T) {
	// Use a test-only mapper; requesting a wildcard group must never resolve
	m := mapper{testWildcardPattern: {"testresources": newResourceTranslation("testresources", "uid", false, nil)}}
	var reg MapperRegistry = m

	_, ok := reg.Get(testWildcardPattern, "testresources")
	assert.False(t, ok, "Get with wildcard group must not return a mapping")

	all := reg.GetAll(testWildcardPattern)
	assert.Nil(t, all, "GetAll with wildcard group must return nil")
}

func TestGroupPrefixForWildcard(t *testing.T) {
	prefix, ok := groupPrefixForWildcard("foo.test.grafana.app", testWildcardPattern)
	require.True(t, ok)
	assert.Equal(t, "foo", prefix)

	prefix, ok = groupPrefixForWildcard("bar.test.grafana.app", testWildcardPattern)
	require.True(t, ok)
	assert.Equal(t, "bar", prefix)

	_, ok = groupPrefixForWildcard("dashboard.grafana.app", testWildcardPattern)
	assert.False(t, ok)
}

func TestTranslationAllowsGroupPrefix(t *testing.T) {
	tr := newResourceTranslation("testresources", "uid", false, nil)
	tr.allowedWildcardPrefixes = []string{"foo", "bar"}

	assert.True(t, translationAllowsGroupPrefix(tr, "foo.test.grafana.app", testWildcardPattern))
	assert.True(t, translationAllowsGroupPrefix(tr, "bar.test.grafana.app", testWildcardPattern))
	assert.False(t, translationAllowsGroupPrefix(tr, "baz.test.grafana.app", testWildcardPattern))

	// nil or empty allowedWildcardPrefixes allows any prefix
	tr.allowedWildcardPrefixes = nil
	assert.True(t, translationAllowsGroupPrefix(tr, "baz.test.grafana.app", testWildcardPattern))
	tr.allowedWildcardPrefixes = []string{}
	assert.True(t, translationAllowsGroupPrefix(tr, "baz.test.grafana.app", testWildcardPattern))

	// exact group key (non-wildcard) always allowed
	tr.allowedWildcardPrefixes = []string{"foo"}
	assert.True(t, translationAllowsGroupPrefix(tr, "dashboard.grafana.app", "dashboard.grafana.app"))
}

func TestMapperRegistry_AllowedWildcardPrefixes(t *testing.T) {
	tr := newResourceTranslation("testresources", "uid", false, nil)
	tr.allowedWildcardPrefixes = []string{"foo", "bar"}

	m := mapper{
		testWildcardPattern: {
			"testresources": tr,
		},
	}
	var reg MapperRegistry = m

	// Allowed prefixes resolve
	_, ok := reg.Get("foo.test.grafana.app", "testresources")
	assert.True(t, ok)
	_, ok = reg.Get("bar.test.grafana.app", "testresources")
	assert.True(t, ok)

	// Disallowed prefix does not resolve
	_, ok = reg.Get("baz.test.grafana.app", "testresources")
	assert.False(t, ok)

	// GetAll only returns translations that allow this group's prefix
	all := reg.GetAll("foo.test.grafana.app")
	require.Len(t, all, 1)
	all = reg.GetAll("baz.test.grafana.app")
	assert.Empty(t, all)
}

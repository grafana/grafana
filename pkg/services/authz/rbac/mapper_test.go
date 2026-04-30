package rbac

import (
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
		mapping, ok := reg.Get(group, "datasources", "")
		require.True(t, ok, "Get(%q, \"datasources\") should find mapping", group)
		require.NotNil(t, mapping)
		assert.Equal(t, "datasources:uid:", mapping.Prefix())
		all := reg.GetAll(group)
		require.Len(t, all, 1)
	}

	// Security: wildcard-matched group must not resolve to resources from other groups
	_, ok := reg.Get("loki.datasource.grafana.app", "dashboards", "")
	assert.False(t, ok, "Get(datasource group, \"dashboards\") must not return a mapping")
}

// TestFindGroupKey_WildcardMatching exercises findGroupKey via a minimal mapper.
// It covers: exact match, wildcard match, group starts with *, key not wildcard (continue),
// suffix mismatch, empty group, and no match.
func TestFindGroupKey_WildcardMatching(t *testing.T) {
	tests := []struct {
		requestedGroup string
		keys           []string // keys in mapper (exact and/or wildcard)
		expectedKey    string
		matches        bool
	}{
		// Exact match: requested group is a key in the mapper
		{"exact.grafana.app", []string{"exact.grafana.app"}, "exact.grafana.app", true},
		// Wildcard match: group has suffix of wildcard key and is longer than suffix
		{"foo.test.grafana.app", []string{testWildcardPattern}, testWildcardPattern, true},
		{"bar.test.grafana.app", []string{testWildcardPattern}, testWildcardPattern, true},
		// group with nested dots does not match wildcard
		{"bar.baz.test.grafana.app", []string{testWildcardPattern}, "", false},
		// Group starts with *: never matches
		{"*.test.grafana.app", []string{testWildcardPattern}, "", false},
		// Key not a wildcard (no *.): iterate and continue, no match
		{"foo.test.grafana.app", []string{"dashboard.grafana.app"}, "", false},
		{"foo.test.grafana.app", []string{"*"}, "", false},
		// Suffix mismatch or group not longer than suffix
		{"dashboard.grafana.app", []string{testWildcardPattern}, "", false},
		{"test.grafana.app", []string{testWildcardPattern}, "", false},
		{"", []string{testWildcardPattern}, "", false},
		// Exact match preferred over wildcard when both exist
		{"foo.test.grafana.app", []string{"foo.test.grafana.app", testWildcardPattern}, "foo.test.grafana.app", true},
	}
	for _, tt := range tests {
		t.Run(tt.requestedGroup+"_"+strings.Join(tt.keys, ","), func(t *testing.T) {
			m := make(mapper)
			for _, k := range tt.keys {
				m[k] = map[string]translation{"r": newResourceTranslation("r", "uid", false, nil)}
			}
			key, ok := m.findGroupKey(tt.requestedGroup)
			assert.Equal(t, tt.matches, ok)
			assert.Equal(t, tt.expectedKey, key)
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
			mapping, ok := reg.Get(group, "testresources", "")
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
			_, ok := reg.Get(tc.group, "testresources", "")
			assert.False(t, ok, "Get(%q) must not return a mapping", tc.group)
			all := reg.GetAll(tc.group)
			assert.Empty(t, all, "GetAll(%q) must not return any mappings", tc.group)
		})
	}
}

func TestMapperRegistry_ExactMatchPreferred(t *testing.T) {
	reg := NewMapperRegistry()

	// Exact group keys still work
	mapping, ok := reg.Get("dashboard.grafana.app", "dashboards", "")
	require.True(t, ok)
	require.NotNil(t, mapping)
	assert.Equal(t, "dashboards:uid:", mapping.Prefix())
}

// TestMapperRegistry_Snapshots verifies snapshots map to the legacy RBAC action names
// and skip scope on all verbs (global actions, no per-resource scope).
func TestMapperRegistry_Snapshots(t *testing.T) {
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("dashboard.grafana.app", "snapshots", "")
	require.True(t, ok, "snapshots must be registered in dashboard.grafana.app")
	require.NotNil(t, mapping)

	tests := []struct {
		verb           string
		expectedAction string
	}{
		{utils.VerbGet, "snapshots:read"},
		{utils.VerbList, "snapshots:read"},
		{utils.VerbWatch, "snapshots:read"},
		{utils.VerbCreate, "snapshots:create"},
		{utils.VerbDelete, "snapshots:delete"},
		{utils.VerbDeleteCollection, "snapshots:delete"},
	}
	for _, tt := range tests {
		t.Run(tt.verb, func(t *testing.T) {
			action, ok := mapping.Action(tt.verb)
			require.True(t, ok)
			assert.Equal(t, tt.expectedAction, action)
			assert.True(t, mapping.SkipScope(tt.verb), "snapshots must skip scope on all verbs")
		})
	}

	assert.False(t, mapping.HasFolderSupport(), "snapshots do not live in folders")
}

func TestMapperRegistry_SubresourceLookup(t *testing.T) {
	parentTr := newResourceTranslation("widgets", "uid", true, nil)
	subTr := translation{
		resource:  "widgets",
		attribute: "uid",
		verbMapping: map[string]string{
			"get":    "widgets.status:read",
			"update": "widgets.status:write",
		},
		folderSupport: false,
	}

	m := mapper{
		"example.grafana.app": {
			"widgets":        parentTr,
			"widgets/status": subTr,
		},
	}
	var reg MapperRegistry = m

	t.Run("empty subresource returns parent resource", func(t *testing.T) {
		mapping, ok := reg.Get("example.grafana.app", "widgets", "")
		require.True(t, ok)
		action, ok := mapping.Action("get")
		assert.True(t, ok)
		assert.Equal(t, "widgets:read", action)
	})

	t.Run("subresource returns subresource mapping", func(t *testing.T) {
		mapping, ok := reg.Get("example.grafana.app", "widgets", "status")
		require.True(t, ok)
		action, ok := mapping.Action("get")
		assert.True(t, ok)
		assert.Equal(t, "widgets.status:read", action)
	})

	t.Run("subresource uses same scope prefix as parent", func(t *testing.T) {
		mapping, ok := reg.Get("example.grafana.app", "widgets", "status")
		require.True(t, ok)
		assert.Equal(t, "widgets:uid:", mapping.Prefix())
		assert.Equal(t, "widgets:uid:abc", mapping.Scope("abc"))
	})

	t.Run("unknown subresource returns false", func(t *testing.T) {
		_, ok := reg.Get("example.grafana.app", "widgets", "nonexistent")
		assert.False(t, ok)
	})

	t.Run("unknown group with subresource returns false", func(t *testing.T) {
		_, ok := reg.Get("unknown.grafana.app", "widgets", "status")
		assert.False(t, ok)
	})

	t.Run("subresource name alone is not a valid resource", func(t *testing.T) {
		_, ok := reg.Get("example.grafana.app", "status", "")
		assert.False(t, ok)
	})
}

// TestMapper_AnnotationSubresource_ActionSets verifies that managed roles (dashboards:view etc.)
// flow through to annotation verbs via the subresource action set mapping.
func TestMapper_AnnotationSubresource_ActionSets(t *testing.T) {
	mapper := NewMapperRegistry()
	mapping, ok := mapper.Get("dashboard.grafana.app", "dashboards", "annotations")
	require.True(t, ok)

	readActionSets := []string{"dashboards:view", "folders:view", "dashboards:edit", "folders:edit", "dashboards:admin", "folders:admin"}
	writeActionSets := []string{"dashboards:edit", "folders:edit", "dashboards:admin", "folders:admin"}

	tests := []struct {
		verb     string
		expected []string
	}{
		{utils.VerbGet, readActionSets},
		{utils.VerbList, readActionSets},
		{utils.VerbWatch, readActionSets},
		{utils.VerbCreate, writeActionSets},
		{utils.VerbUpdate, writeActionSets},
		{utils.VerbPatch, writeActionSets},
		{utils.VerbDelete, writeActionSets},
	}

	for _, tt := range tests {
		t.Run(tt.verb, func(t *testing.T) {
			assert.ElementsMatch(t, tt.expected, mapping.ActionSets(tt.verb))
		})
	}
}

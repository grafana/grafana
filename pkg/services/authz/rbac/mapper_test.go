package rbac

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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

		// The datasources/query subresource is also mapped to a query action.
		queryMapping, ok := reg.Get(group, "datasources", "query")
		require.True(t, ok, "Get(%q, \"datasources\", \"query\") should find mapping", group)
		require.NotNil(t, queryMapping)
		action, ok := queryMapping.Action(utils.VerbCreate)
		assert.True(t, ok)
		assert.Equal(t, "datasources:query", action)

		// The group exposes both the datasources resource and its query subresource.
		all := reg.GetAll(group)
		require.Len(t, all, 2)
	}

	// Security: wildcard-matched group must not resolve to resources from other groups
	_, ok := reg.Get("loki.datasource.grafana.app", "dashboards", "")
	assert.False(t, ok, "Get(datasource group, \"dashboards\") must not return a mapping")
}

// TestMapperRegistry_Playlist verifies playlists map to their real two-action model
// (playlists:read / playlists:write) rather than the default create/delete actions, and
// that create skips scope since playlists are neither folder-scoped nor scope-checked.
// This is what lets the provisioning export preflight authorize playlists.
func TestMapperRegistry_Playlist(t *testing.T) {
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("playlist.grafana.app", "playlists", "")
	require.True(t, ok, "playlists should be registered in the mapper")
	require.NotNil(t, mapping)

	for _, verb := range []string{utils.VerbGet, utils.VerbList, utils.VerbWatch} {
		action, ok := mapping.Action(verb)
		assert.True(t, ok)
		assert.Equal(t, "playlists:read", action, "verb %q should map to read", verb)
	}
	for _, verb := range []string{utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch, utils.VerbDelete, utils.VerbDeleteCollection} {
		action, ok := mapping.Action(verb)
		assert.True(t, ok)
		assert.Equal(t, "playlists:write", action, "verb %q should map to write (no playlists:create/delete action exists)", verb)
	}

	assert.True(t, mapping.SkipScope(utils.VerbCreate), "create must skip scope; playlists are not folder-scoped")
	assert.False(t, mapping.HasFolderSupport(), "playlists are not folder-scoped")
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

// TestMapper_ServiceAccountTranslation_ActionSets verifies that service account verbs map to the
// correct action sets. There is no View level — Edit verbs map to both edit+admin, and admin-only
// verbs (delete, permissions) map to admin only.
func TestMapper_ServiceAccountTranslation_ActionSets(t *testing.T) {
	reg := NewMapperRegistry()
	mapping, ok := reg.Get("iam.grafana.app", "serviceaccounts", "")
	require.True(t, ok)

	editAndAdmin := []string{"serviceaccounts:edit", "serviceaccounts:admin"}
	adminOnly := []string{"serviceaccounts:admin"}
	empty := []string(nil)

	tests := []struct {
		verb     string
		expected []string
	}{
		{utils.VerbGet, editAndAdmin},
		{utils.VerbList, editAndAdmin},
		{utils.VerbWatch, editAndAdmin},
		{utils.VerbUpdate, editAndAdmin},
		{utils.VerbPatch, editAndAdmin},
		{utils.VerbDelete, adminOnly},
		{utils.VerbDeleteCollection, adminOnly},
		{utils.VerbGetPermissions, adminOnly},
		{utils.VerbSetPermissions, adminOnly},
		{utils.VerbCreate, empty},
	}

	for _, tt := range tests {
		t.Run(tt.verb, func(t *testing.T) {
			assert.Equal(t, tt.expected, mapping.ActionSets(tt.verb))
		})
	}
}

// TestMapperRegistry_AlertRules verifies the rules.alerting.grafana.app rule
// resources map to the alert.rules:* actions, support folder inheritance, use a
// rules-specific direct-scope prefix (so the per-object check never spuriously
// matches a folder grant), and flow through the folder action sets
// (folders:view/edit/admin) for managed roles.
func TestMapperRegistry_AlertRules(t *testing.T) {
	reg := NewMapperRegistry()

	readActionSets := []string{"folders:view", "folders:edit", "folders:admin"}
	writeActionSets := []string{"folders:edit", "folders:admin"}

	for _, resource := range []string{"alertrules", "recordingrules", "rulesequences"} {
		t.Run(resource, func(t *testing.T) {
			mapping, ok := reg.Get("rules.alerting.grafana.app", resource, "")
			require.True(t, ok, "%q should be registered in the mapper", resource)
			require.NotNil(t, mapping)

			// Alert-rule permissions are folder-scoped via folder inheritance, not via
			// the per-object direct scope. The resource is "alert.rules" so Scope()
			// yields alert.rules:uid:<name> — a scope no grant ever has — which makes
			// the direct-scope check a no-op and avoids colliding a rule UID with a
			// folder grant (folders:uid:<uid>).
			assert.True(t, mapping.HasFolderSupport(), "alert rules are folder-scoped")
			assert.Equal(t, "alert.rules:uid:", mapping.Prefix())
			assert.Equal(t, "alert.rules:uid:abc", mapping.Scope("abc"))

			actionTests := []struct {
				verb   string
				action string
			}{
				{utils.VerbGet, "alert.rules:read"},
				{utils.VerbList, "alert.rules:read"},
				{utils.VerbWatch, "alert.rules:read"},
				{utils.VerbCreate, "alert.rules:create"},
				{utils.VerbUpdate, "alert.rules:write"},
				{utils.VerbPatch, "alert.rules:write"},
				{utils.VerbDelete, "alert.rules:delete"},
				{utils.VerbDeleteCollection, "alert.rules:delete"},
			}
			for _, tt := range actionTests {
				action, ok := mapping.Action(tt.verb)
				assert.True(t, ok, "verb %q should map to an action", tt.verb)
				assert.Equal(t, tt.action, action, "verb %q", tt.verb)
			}

			actionSetTests := []struct {
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
				{utils.VerbDeleteCollection, writeActionSets},
			}
			for _, tt := range actionSetTests {
				assert.ElementsMatch(t, tt.expected, mapping.ActionSets(tt.verb), "action sets for verb %q", tt.verb)
			}
		})
	}
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

func TestMapperRegistry_Settings(t *testing.T) {
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("setting.grafana.app", "settings", "")
	require.True(t, ok, "settings should be registered in the mapper")
	require.NotNil(t, mapping)

	for _, verb := range []string{utils.VerbGet, utils.VerbList, utils.VerbWatch} {
		action, ok := mapping.Action(verb)
		assert.True(t, ok)
		assert.Equal(t, accesscontrol.ActionSettingsRead, action, "verb %q should map to settings:read", verb)
	}
	for _, verb := range []string{utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch, utils.VerbDelete, utils.VerbDeleteCollection} {
		action, ok := mapping.Action(verb)
		assert.True(t, ok)
		assert.Equal(t, accesscontrol.ActionSettingsWrite, action, "verb %q should map to settings:write", verb)
	}

	assert.Equal(t, "settings:uid:auth.saml", mapping.Scope("auth.saml"))
	assert.Equal(t, "settings:uid:", mapping.Prefix())
	assert.False(t, mapping.HasFolderSupport())
}

package rbac

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestMapperRegistry_DatasourceAliases(t *testing.T) {
	reg := NewMapperRegistry()

	// Plugin API groups resolve to the shared datasource permissions.
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

		// Aliases are accepted for requests but are not registered groups.
		assert.Empty(t, reg.GetAll(group))
	}

	// Plugin groups must not resolve to resources from other groups
	_, ok := reg.Get("loki.datasource.grafana.app", "dashboards", "")
	assert.False(t, ok, "Get(datasource group, \"dashboards\") must not return a mapping")
}

// Unified storage stores every datasource type under datasource.grafana.app, so
// storage checks must resolve to the same permissions as the per-plugin groups.
func TestMapperRegistry_DatasourceSharedGroup(t *testing.T) {
	reg := NewMapperRegistry()

	for _, subresource := range []string{"", "query", "caching"} {
		shared, ok := reg.Get("datasource.grafana.app", "datasources", subresource)
		require.True(t, ok)
		plugin, ok := reg.Get("loki.datasource.grafana.app", "datasources", subresource)
		require.True(t, ok)

		assert.Equal(t, plugin.Prefix(), shared.Prefix())
		for _, verb := range []string{
			utils.VerbGet, utils.VerbList, utils.VerbWatch, utils.VerbCreate, utils.VerbUpdate,
			utils.VerbPatch, utils.VerbDelete, utils.VerbDeleteCollection,
		} {
			sharedAction, sharedOK := shared.Action(verb)
			pluginAction, pluginOK := plugin.Action(verb)
			assert.Equal(t, pluginOK, sharedOK, "subresource %q, verb %q", subresource, verb)
			assert.Equal(t, pluginAction, sharedAction, "subresource %q, verb %q", subresource, verb)
			assert.Equal(t, plugin.ActionSets(verb), shared.ActionSets(verb), "subresource %q, verb %q", subresource, verb)
		}
	}

	query, ok := reg.Get("datasource.grafana.app", "query", "")
	require.True(t, ok)
	action, ok := query.Action(utils.VerbCreate)
	require.True(t, ok)
	assert.Equal(t, "datasources:query", action)
}

func TestMapperRegistry_QueryAliases(t *testing.T) {
	reg := NewMapperRegistry()
	canonical, ok := reg.Get("datasource.grafana.app", "datasources", "query")
	require.True(t, ok)

	for _, group := range []string{"query.grafana.app", "datasource.grafana.app"} {
		t.Run(group, func(t *testing.T) {
			alias, ok := reg.Get(group, "query", "")
			require.True(t, ok)
			assert.Equal(t, canonical, alias)
			assert.Equal(t, "datasources:uid:ds1", alias.Scope("ds1"))
			for _, verb := range []string{utils.VerbGet, utils.VerbList, utils.VerbWatch,
				utils.VerbUpdate, utils.VerbPatch, utils.VerbDelete, utils.VerbDeleteCollection} {
				_, ok := alias.Action(verb)
				assert.False(t, ok, "query must not grant verb %q", verb)
			}

			_, ok = reg.Get(group, "query", "caching")
			assert.False(t, ok, "query aliases must not accept subresources")
		})
	}
	for _, group := range []string{"loki.datasource.grafana.app", "dashboard.grafana.app"} {
		_, ok := reg.Get(group, "query", "")
		assert.False(t, ok, "standalone query must not resolve in %q", group)
	}
	_, ok = reg.Get("query.grafana.app", "datasources", "query")
	assert.False(t, ok)
}

func TestMapperRegistry_DatasourceEnumeration(t *testing.T) {
	reg := NewMapperRegistry()
	assert.NotContains(t, reg.GetGroups(), "query.grafana.app")
	assert.Empty(t, reg.ResourceMappings("query.grafana.app"))
	assert.Empty(t, reg.ResourceMappings("loki.datasource.grafana.app"))

	mappings := reg.ResourceMappings("datasource.grafana.app")
	resources := make([]string, 0, len(mappings))
	for _, mapping := range mappings {
		resources = append(resources, mapping.APIResource)
	}
	assert.ElementsMatch(t, []string{"datasources", "datasources/query", "datasources/caching"}, resources)

	// A plugin's own registered resources must not be replaced with shared datasource mappings.
	reg.(mapper)["loki.datasource.grafana.app"] = map[string]translation{
		"custom": newResourceTranslation("custom", "uid", false, nil),
	}
	mappings = reg.ResourceMappings("loki.datasource.grafana.app")
	require.Len(t, mappings, 1)
	assert.Equal(t, "custom", mappings[0].APIResource)
}

// App plugin settings are stored as plugins.grafana.app/app/{pluginID}, so the
// name resolves to the legacy plugins:id:{pluginID} scope.
func TestMapperRegistry_AppSettings(t *testing.T) {
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("plugins.grafana.app", "app", "")
	require.True(t, ok)
	assert.Equal(t, "plugins:id:grafana-lokiexplore-app", mapping.Scope("grafana-lokiexplore-app"))

	for verb, expected := range map[string]string{
		utils.VerbGet:    "plugins.app:access",
		utils.VerbList:   "plugins.app:access",
		utils.VerbUpdate: "plugins:write",
		utils.VerbDelete: "plugins:write",
	} {
		action, ok := mapping.Action(verb)
		require.True(t, ok, "verb %q", verb)
		assert.Equal(t, expected, action, "verb %q", verb)
	}
}

func TestMapperRegistry_DatasourceCachingSubresource(t *testing.T) {
	reg := NewMapperRegistry()

	for _, group := range []string{"datasource.grafana.app", "prometheus.datasource.grafana.app", "loki.datasource.grafana.app"} {
		mapping, ok := reg.Get(group, "datasources", "caching")
		require.True(t, ok, "Get(%q, \"datasources\", \"caching\") should find mapping", group)
		require.NotNil(t, mapping)

		assert.Equal(t, "datasources:uid:", mapping.Prefix())

		for _, verb := range []string{utils.VerbGet, utils.VerbList, utils.VerbWatch} {
			action, ok := mapping.Action(verb)
			require.True(t, ok, "verb %q should map", verb)
			assert.Equal(t, "datasources.caching:read", action, "verb %q", verb)
		}

		for _, verb := range []string{utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch, utils.VerbDelete, utils.VerbDeleteCollection} {
			action, ok := mapping.Action(verb)
			require.True(t, ok, "verb %q should map", verb)
			assert.Equal(t, "datasources.caching:write", action, "verb %q", verb)
		}
	}

	_, ok := reg.Get("dashboard.grafana.app", "datasources", "caching")
	assert.False(t, ok, "caching subresource must not resolve outside the datasource groups")
}

// Mapping :edit or :query here would grant caching to users who lack it.
func TestMapperRegistry_DatasourceCachingActionSets(t *testing.T) {
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("prometheus.datasource.grafana.app", "datasources", "caching")
	require.True(t, ok)

	allVerbs := []string{
		utils.VerbGet, utils.VerbList, utils.VerbWatch, utils.VerbCreate,
		utils.VerbUpdate, utils.VerbPatch, utils.VerbDelete, utils.VerbDeleteCollection,
	}
	for _, verb := range allVerbs {
		sets := mapping.ActionSets(verb)
		require.NotEmpty(t, sets, "verb %q must map to an action set", verb)
		assert.Equal(t, []string{"datasources:admin"}, sets,
			"verb %q: only datasources:admin carries the caching actions", verb)
	}
}

func TestMapperRegistry_Snapshots(t *testing.T) {
	reg := NewMapperRegistry()
	mapping, ok := reg.Get("dashboard.grafana.app", "snapshots", "")
	require.True(t, ok)
	assert.False(t, mapping.HasFolderSupport())

	for verb, action := range map[string]string{
		utils.VerbGet:    "snapshots:read",
		utils.VerbList:   "snapshots:read",
		utils.VerbWatch:  "snapshots:read",
		utils.VerbCreate: "snapshots:create",
		utils.VerbDelete: "snapshots:delete",
	} {
		t.Run(verb, func(t *testing.T) {
			got, ok := mapping.Action(verb)
			require.True(t, ok)
			assert.Equal(t, action, got)
			assert.True(t, mapping.SkipScope(verb))

			allowed, err := (&Service{}).checkPermissionWithMapping(context.Background(), map[string]bool{"": true},
				&checkRequest{Verb: verb}, mapping, nil)
			require.NoError(t, err)
			assert.True(t, allowed)
		})
	}

	for _, verb := range []string{utils.VerbUpdate, utils.VerbPatch, utils.VerbDeleteCollection} {
		_, ok := mapping.Action(verb)
		assert.False(t, ok, "verb %q must not grant snapshot writes", verb)
	}
	_, ok = reg.Get("dashboard.grafana.app", "snapshots", "dashboard")
	assert.False(t, ok, "dashboard subresource must not inherit snapshot write permissions")
}

// TestMapperRegistry_Playlist verifies playlists map to their real two-action model
// (playlists:read / playlists:write) rather than the default create/delete actions, and
// that every verb skips scope since playlists are neither folder-scoped nor scope-checked.
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

	for _, verb := range []string{utils.VerbGet, utils.VerbList, utils.VerbWatch, utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch, utils.VerbDelete, utils.VerbDeleteCollection} {
		assert.True(t, mapping.SkipScope(verb), "verb %q must skip scope; playlist roles are unscoped", verb)
	}
	assert.False(t, mapping.HasFolderSupport(), "playlists are not folder-scoped")
}

func TestMapperRegistry_InvalidDatasourceGroups(t *testing.T) {
	reg := NewMapperRegistry()
	for _, group := range []string{
		"*.datasource.grafana.app",
		"foo.bar.datasource.grafana.app",
		"loki.datasource.grafana.app.evil",
		"unknown.grafana.app",
		"",
	} {
		t.Run(group, func(t *testing.T) {
			for _, subresource := range []string{"", "query", "caching"} {
				_, ok := reg.Get(group, "datasources", subresource)
				assert.False(t, ok)
			}
			assert.Empty(t, reg.ResourceMappings(group))
		})
	}
}

func TestMapperRegistry_ExactGroup(t *testing.T) {
	reg := NewMapperRegistry()

	// Exact group keys still work
	mapping, ok := reg.Get("dashboard.grafana.app", "dashboards", "")
	require.True(t, ok)
	require.NotNil(t, mapping)
	assert.Equal(t, "dashboards:uid:", mapping.Prefix())
}

func TestMapperRegistry_Variables(t *testing.T) {
	reg := NewMapperRegistry()
	mapping, ok := reg.Get("dashboard.grafana.app", "variables", "")
	require.True(t, ok)
	require.NotNil(t, mapping)
	assert.Equal(t, "variables:uid:", mapping.Prefix())
	assert.True(t, mapping.HasFolderSupport())

	action, ok := mapping.Action("create")
	require.True(t, ok)
	assert.Equal(t, "variables:create", action)
	action, ok = mapping.Action("get")
	require.True(t, ok)
	assert.Equal(t, "variables:read", action)
	action, ok = mapping.Action("update")
	require.True(t, ok)
	assert.Equal(t, "variables:write", action)
	action, ok = mapping.Action("delete")
	require.True(t, ok)
	assert.Equal(t, "variables:delete", action)

	readActionSets := []string{"folders:view", "folders:edit", "folders:admin"}
	writeActionSets := []string{"folders:edit", "folders:admin"}
	assert.ElementsMatch(t, readActionSets, mapping.ActionSets(utils.VerbGet))
	assert.ElementsMatch(t, readActionSets, mapping.ActionSets(utils.VerbList))
	assert.ElementsMatch(t, writeActionSets, mapping.ActionSets(utils.VerbCreate))
	assert.ElementsMatch(t, writeActionSets, mapping.ActionSets(utils.VerbUpdate))
	assert.ElementsMatch(t, writeActionSets, mapping.ActionSets(utils.VerbDelete))
}

// TestMapperRegistry_LibraryPanels verifies library panels map to library.panels:*
// and flow through the folder action sets. Library panels have no action sets of
// their own, so without the folder mapping a user granted folder Edit through a
// managed role would not be seen to hold them.
func TestMapperRegistry_LibraryPanels(t *testing.T) {
	reg := NewMapperRegistry()
	mapping, ok := reg.Get("dashboard.grafana.app", "librarypanels", "")
	require.True(t, ok)
	require.NotNil(t, mapping)
	assert.Equal(t, "library.panels:uid:", mapping.Prefix())
	assert.True(t, mapping.HasFolderSupport())

	readActionSets := []string{"folders:view", "folders:edit", "folders:admin"}
	writeActionSets := []string{"folders:edit", "folders:admin"}

	tests := []struct {
		verb       string
		action     string
		actionSets []string
	}{
		{utils.VerbGet, "library.panels:read", readActionSets},
		{utils.VerbList, "library.panels:read", readActionSets},
		{utils.VerbCreate, "library.panels:create", writeActionSets},
		{utils.VerbUpdate, "library.panels:write", writeActionSets},
		{utils.VerbDelete, "library.panels:delete", writeActionSets},
	}
	for _, tt := range tests {
		t.Run(tt.verb, func(t *testing.T) {
			action, ok := mapping.Action(tt.verb)
			require.True(t, ok, "verb %q should map to an action", tt.verb)
			assert.Equal(t, tt.action, action)
			assert.ElementsMatch(t, tt.actionSets, mapping.ActionSets(tt.verb))
		})
	}
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

// TestMapperRegistry_Notebooks verifies notebooks have their own notebooks:* actions and a
// notebooks:uid: scope, and — being folder-scoped like dashboards — map their verbs onto the
// folder action sets so folder grants cover them.
func TestMapperRegistry_Notebooks(t *testing.T) {
	reg := NewMapperRegistry()
	mapping, ok := reg.Get("dashboard.grafana.app", "notebooks", "")
	require.True(t, ok)
	require.NotNil(t, mapping)

	// Dedicated notebook actions per verb.
	for verb, want := range map[string]string{
		utils.VerbGet:              "notebooks:read",
		utils.VerbList:             "notebooks:read",
		utils.VerbWatch:            "notebooks:read",
		utils.VerbCreate:           "notebooks:create",
		utils.VerbUpdate:           "notebooks:write",
		utils.VerbPatch:            "notebooks:write",
		utils.VerbDelete:           "notebooks:delete",
		utils.VerbDeleteCollection: "notebooks:delete",
	} {
		action, ok := mapping.Action(verb)
		require.True(t, ok, "verb %q should map to an action", verb)
		assert.Equal(t, want, action, "verb %q", verb)
	}

	// Verbs map onto the folder action sets (read via all three, write/delete/create via edit+admin)
	// so folder view/edit/admin grants cover notebooks.
	assert.ElementsMatch(t, []string{"folders:view", "folders:edit", "folders:admin"}, mapping.ActionSets(utils.VerbGet))
	assert.ElementsMatch(t, []string{"folders:edit", "folders:admin"}, mapping.ActionSets(utils.VerbCreate))
	assert.ElementsMatch(t, []string{"folders:edit", "folders:admin"}, mapping.ActionSets(utils.VerbDelete))
	assert.True(t, mapping.HasFolderSupport())

	// set_permissions must resolve (to folders:admin) — the trash folder-admin check authorizes
	// via this verb, so an unsupported verb here would break trash listing for folder admins.
	setPerms, ok := mapping.Action(utils.VerbSetPermissions)
	require.True(t, ok)
	assert.Equal(t, "notebooks.permissions:write", setPerms)
	assert.ElementsMatch(t, []string{"folders:admin"}, mapping.ActionSets(utils.VerbSetPermissions))

	// Object scope stays in the notebook's own namespace.
	assert.Equal(t, "notebooks:uid:", mapping.Prefix())
	assert.Equal(t, "notebooks:uid:nb1", mapping.Scope("nb1"))
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

// TestMapperRegistry_Silences verifies silences map to the alert.silences:*
// actions, support folder inheritance, and use a silences-specific direct-scope
// prefix so the per-object check never spuriously matches a folder grant. There
// is no silence kind served on this group yet; the translation exists so
// folder-scoped silence capability checks resolve.
func TestMapperRegistry_Silences(t *testing.T) {
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("notifications.alerting.grafana.app", "silences", "")
	require.True(t, ok, "silences should be registered in the mapper")
	require.NotNil(t, mapping)

	assert.True(t, mapping.HasFolderSupport(), "silence permissions are folder-scoped")
	assert.Equal(t, "alert.silences:uid:", mapping.Prefix())
	assert.Equal(t, "alert.silences:uid:abc", mapping.Scope("abc"))

	readActionSets := []string{"folders:view", "folders:edit", "folders:admin"}
	writeActionSets := []string{"folders:edit", "folders:admin"}

	tests := []struct {
		verb       string
		action     string
		actionSets []string
	}{
		{utils.VerbGet, "alert.silences:read", readActionSets},
		{utils.VerbList, "alert.silences:read", readActionSets},
		{utils.VerbWatch, "alert.silences:read", readActionSets},
		{utils.VerbCreate, "alert.silences:create", writeActionSets},
		// There is no alert.silences:delete action; expiring a silence is a write.
		{utils.VerbUpdate, "alert.silences:write", writeActionSets},
		{utils.VerbPatch, "alert.silences:write", writeActionSets},
		{utils.VerbDelete, "alert.silences:write", writeActionSets},
		{utils.VerbDeleteCollection, "alert.silences:write", writeActionSets},
	}
	for _, tt := range tests {
		t.Run(tt.verb, func(t *testing.T) {
			action, ok := mapping.Action(tt.verb)
			assert.True(t, ok, "verb %q should map to an action", tt.verb)
			assert.Equal(t, tt.action, action)
			assert.ElementsMatch(t, tt.actionSets, mapping.ActionSets(tt.verb))
		})
	}
}

// TestMapperRegistry_AlertingConfigs verifies the notifications and rules app
// Config singletons map to their own decoupled scopes and actions, with status
// writes gated on the service-only status action and delete left unmapped.
func TestMapperRegistry_AlertingConfigs(t *testing.T) {
	reg := NewMapperRegistry()

	tests := []struct {
		group        string
		prefix       string
		readAction   string
		updateAction string
		statusAction string
	}{
		{
			group:        "notifications.alerting.grafana.app",
			prefix:       "configs:uid:",
			readAction:   accesscontrol.ActionAlertingConfigRead,
			updateAction: accesscontrol.ActionAlertingConfigUpdate,
			statusAction: accesscontrol.ActionAlertingConfigStatusUpdate,
		},
		{
			group:        "rules.alerting.grafana.app",
			prefix:       "rules-configs:uid:",
			readAction:   accesscontrol.ActionAlertingRulesConfigRead,
			updateAction: accesscontrol.ActionAlertingRulesConfigUpdate,
			statusAction: accesscontrol.ActionAlertingRulesConfigStatusUpdate,
		},
	}
	for _, tt := range tests {
		t.Run(tt.group, func(t *testing.T) {
			for subresource, writeAction := range map[string]string{"": tt.updateAction, "status": tt.statusAction} {
				mapping, ok := reg.Get(tt.group, "configs", subresource)
				require.True(t, ok, "configs (subresource %q) should be registered in the mapper", subresource)

				assert.False(t, mapping.HasFolderSupport())
				assert.Equal(t, tt.prefix, mapping.Prefix())
				assert.Equal(t, tt.prefix+"default", mapping.Scope("default"))

				for _, verb := range []string{utils.VerbGet, utils.VerbList, utils.VerbWatch} {
					action, ok := mapping.Action(verb)
					assert.True(t, ok)
					assert.Equal(t, tt.readAction, action, "verb %q", verb)
				}
				for _, verb := range []string{utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch} {
					action, ok := mapping.Action(verb)
					assert.True(t, ok)
					assert.Equal(t, writeAction, action, "verb %q", verb)
				}
				for _, verb := range []string{utils.VerbDelete, utils.VerbDeleteCollection} {
					_, ok := mapping.Action(verb)
					assert.False(t, ok, "verb %q should not be mapped", verb)
				}
			}
		})
	}
}

// TestMapperRegistry_AssistantAlertRules verifies the assistant's external collection authorizes like the native rule kinds.
func TestMapperRegistry_AssistantAlertRules(t *testing.T) {
	reg := NewMapperRegistry()

	mapping, ok := reg.Get("assistant.alertrules.ext.grafana.app", "alertrules", "")
	require.True(t, ok, "assistant alertrules collection should be registered in the mapper")
	require.NotNil(t, mapping)

	assert.True(t, mapping.HasFolderSupport(), "alert rules are folder-scoped")
	assert.Equal(t, "alert.rules:uid:", mapping.Prefix())

	action, ok := mapping.Action(utils.VerbGet)
	require.True(t, ok)
	assert.Equal(t, "alert.rules:read", action)
	assert.ElementsMatch(t, []string{"folders:view", "folders:edit", "folders:admin"}, mapping.ActionSets(utils.VerbGet))
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

func TestMapperRegistry_ResourceMappings_UnknownGroup(t *testing.T) {
	reg := NewMapperRegistry()
	assert.Nil(t, reg.ResourceMappings("unknown.grafana.app"))
}

func TestMapperRegistry_ResourceMappings_DashboardGroup(t *testing.T) {
	reg := NewMapperRegistry()

	mappings := reg.ResourceMappings("dashboard.grafana.app")
	require.NotEmpty(t, mappings)

	byAPIResource := make(map[string]Mapping, len(mappings))
	for _, rm := range mappings {
		require.NotEmpty(t, rm.APIResource)
		require.NotNil(t, rm.Mapping)
		byAPIResource[rm.APIResource] = rm.Mapping
	}

	assert.Contains(t, byAPIResource, "dashboards")
	assert.Contains(t, byAPIResource, "librarypanels")
	assert.Contains(t, byAPIResource, "dashboards/annotations")
	assert.Contains(t, byAPIResource, "notebooks")
	assert.Contains(t, byAPIResource, "variables")

	dashboards, ok := reg.Get("dashboard.grafana.app", "dashboards", "")
	require.True(t, ok)
	assert.Equal(t, dashboards.Prefix(), byAPIResource["dashboards"].Prefix())
	assert.Equal(t, "dashboards:uid:", byAPIResource["dashboards"].Prefix())

	libraryPanels, ok := reg.Get("dashboard.grafana.app", "librarypanels", "")
	require.True(t, ok)
	assert.Equal(t, libraryPanels.Prefix(), byAPIResource["librarypanels"].Prefix())

	annotations, ok := reg.Get("dashboard.grafana.app", "dashboards", "annotations")
	require.True(t, ok)
	assert.Equal(t, annotations.Prefix(), byAPIResource["dashboards/annotations"].Prefix())
	action, ok := byAPIResource["dashboards/annotations"].Action(utils.VerbGet)
	assert.True(t, ok)
	assert.Equal(t, "annotations:read", action)
}

func TestReportingLegacyMapping(t *testing.T) {
	reg := NewMapperRegistry()
	for _, tc := range []struct {
		resource, verb, action string
		skipScope              bool
	}{
		{"reports", "get", "reports:read", false},
		{"reports", "list", "reports:read", false},
		{"reports", "watch", "reports:read", false},
		{"reports", "create", "reports:create", true},
		{"reports", "update", "reports:write", false},
		{"reports", "patch", "reports:write", false},
		{"reports", "delete", "reports:delete", false},
		{"reportsettings", "get", "reports.settings:read", true},
		{"reportsettings", "list", "reports.settings:read", true},
		{"reportsettings", "watch", "reports.settings:read", true},
		{"reportsettings", "create", "reports.settings:write", true},
		{"reportsettings", "update", "reports.settings:write", true},
		{"reportsettings", "patch", "reports.settings:write", true},
		{"reportsettings", "delete", "reports.settings:write", true},
	} {
		t.Run(tc.resource+"/"+tc.verb, func(t *testing.T) {
			mapping, ok := reg.Get("reporting.grafana.app", tc.resource, "")
			require.True(t, ok, "existing report roles must authorize the new API")
			action, ok := mapping.Action(tc.verb)
			require.True(t, ok)
			require.Equal(t, tc.action, action)
			require.Equal(t, tc.skipScope, mapping.SkipScope(tc.verb))
			if tc.resource == "reports" {
				require.Equal(t, "reports:uid:weekly", mapping.Scope("weekly"))
			}
			require.False(t, mapping.HasFolderSupport())
		})
	}
}

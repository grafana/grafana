package rbac

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestK8sNativeMapping_Action(t *testing.T) {
	m := newK8sNativeMapping("myapp.ext.grafana.app", "widgets", "")

	tests := []struct {
		verb           string
		expectedAction string
		expectOk       bool
	}{
		// Direct verbs
		{utils.VerbGet, "myapp.ext.grafana.app/widgets:get", true},
		{utils.VerbCreate, "myapp.ext.grafana.app/widgets:create", true},
		{utils.VerbUpdate, "myapp.ext.grafana.app/widgets:update", true},
		{utils.VerbDelete, "myapp.ext.grafana.app/widgets:delete", true},
		{utils.VerbGetPermissions, "myapp.ext.grafana.app/widgets:get_permissions", true},
		{utils.VerbSetPermissions, "myapp.ext.grafana.app/widgets:set_permissions", true},
		// Collapsed verbs
		{utils.VerbList, "myapp.ext.grafana.app/widgets:get", true},
		{utils.VerbWatch, "myapp.ext.grafana.app/widgets:get", true},
		{utils.VerbPatch, "myapp.ext.grafana.app/widgets:update", true},
		{utils.VerbDeleteCollection, "myapp.ext.grafana.app/widgets:delete", true},
		// Unknown verb
		{"unknownverb", "", false},
		{"", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.verb, func(t *testing.T) {
			action, ok := m.Action(tt.verb)
			assert.Equal(t, tt.expectOk, ok)
			assert.Equal(t, tt.expectedAction, action)
		})
	}
}

func TestK8sNativeMapping_Action_WithSubresource(t *testing.T) {
	m := newK8sNativeMapping("myapp.ext.grafana.app", "widgets", "buttons")

	tests := []struct {
		verb           string
		expectedAction string
		expectOk       bool
	}{
		// Direct verbs
		{utils.VerbGet, "myapp.ext.grafana.app/widgets/buttons:get", true},
		{utils.VerbCreate, "myapp.ext.grafana.app/widgets/buttons:create", true},
		{utils.VerbUpdate, "myapp.ext.grafana.app/widgets/buttons:update", true},
		{utils.VerbDelete, "myapp.ext.grafana.app/widgets/buttons:delete", true},
		{utils.VerbGetPermissions, "myapp.ext.grafana.app/widgets/buttons:get_permissions", true},
		{utils.VerbSetPermissions, "myapp.ext.grafana.app/widgets/buttons:set_permissions", true},
		// Collapsed verbs
		{utils.VerbList, "myapp.ext.grafana.app/widgets/buttons:get", true},
		{utils.VerbWatch, "myapp.ext.grafana.app/widgets/buttons:get", true},
		{utils.VerbPatch, "myapp.ext.grafana.app/widgets/buttons:update", true},
		{utils.VerbDeleteCollection, "myapp.ext.grafana.app/widgets/buttons:delete", true},
		// Unknown verb
		{"unknownverb", "", false},
		{"", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.verb, func(t *testing.T) {
			action, ok := m.Action(tt.verb)
			assert.Equal(t, tt.expectOk, ok)
			assert.Equal(t, tt.expectedAction, action)
		})
	}
}

func TestK8sNativeMapping_ActionSets(t *testing.T) {
	m := newK8sNativeMapping("myapp.ext.grafana.app", "widgets", "")
	// K8s-native resources have no legacy RBAC action sets.
	for _, verb := range []string{utils.VerbGet, utils.VerbList, utils.VerbCreate, utils.VerbUpdate, utils.VerbDelete} {
		assert.Nil(t, m.ActionSets(verb), "ActionSets should be nil for verb %q", verb)
	}
}

func TestK8sNativeMapping_Scope(t *testing.T) {
	m := newK8sNativeMapping("myapp.ext.grafana.app", "widgets", "")

	assert.Equal(t, "myapp.ext.grafana.app/widgets:uid:abc123", m.Scope("abc123"))
	assert.Equal(t, "myapp.ext.grafana.app/widgets:uid:some-uid", m.Scope("some-uid"))
	assert.Equal(t, "myapp.ext.grafana.app/widgets:uid:", m.Scope(""))

	// Scopes should be the same as the parent resource
	m = newK8sNativeMapping("myapp.ext.grafana.app", "widgets", "buttons")
	assert.Equal(t, "myapp.ext.grafana.app/widgets:uid:abc123", m.Scope("abc123"))
	assert.Equal(t, "myapp.ext.grafana.app/widgets:uid:some-uid", m.Scope("some-uid"))
	assert.Equal(t, "myapp.ext.grafana.app/widgets:uid:", m.Scope(""))
}

func TestK8sNativeMapping_Prefix(t *testing.T) {
	m := newK8sNativeMapping("myapp.ext.grafana.app", "widgets", "")
	assert.Equal(t, "myapp.ext.grafana.app/widgets:uid:", m.Prefix())
}

func TestK8sNativeMapping_HasFolderSupport(t *testing.T) {
	m := newK8sNativeMapping("myapp.ext.grafana.app", "widgets", "")
	assert.True(t, m.HasFolderSupport(),
		"K8s-native mappings always report folder support so that folder-scoped inheritance works correctly")
}

func TestK8sNativeMapping_SkipScope(t *testing.T) {
	m := newK8sNativeMapping("myapp.ext.grafana.app", "widgets", "")
	for _, verb := range []string{utils.VerbGet, utils.VerbCreate, utils.VerbUpdate, utils.VerbDelete, utils.VerbGetPermissions, utils.VerbSetPermissions} {
		assert.False(t, m.SkipScope(verb), "SkipScope should be false for verb %q", verb)
	}
}

func TestK8sNativeMapping_Resource(t *testing.T) {
	m := newK8sNativeMapping("myapp.ext.grafana.app", "widgets", "")
	assert.Equal(t, "widgets", m.Resource(), "Resource() should return the K8s resource name without the group prefix")
}

func TestK8sNativeMapping_AllActions(t *testing.T) {
	m := newK8sNativeMapping("myapp.ext.grafana.app", "widgets", "")
	actions := m.AllActions()

	// Must be deduplicated (list/watch collapse to get, patch to update, deletecollection to delete)
	expected := []string{
		"myapp.ext.grafana.app/widgets:create",
		"myapp.ext.grafana.app/widgets:delete",
		"myapp.ext.grafana.app/widgets:get",
		"myapp.ext.grafana.app/widgets:get_permissions",
		"myapp.ext.grafana.app/widgets:set_permissions",
		"myapp.ext.grafana.app/widgets:update",
	}

	sort.Strings(actions)
	assert.Equal(t, expected, actions)
}

func TestK8sNativeMapping_AllActions_WithSubresource(t *testing.T) {
	m := newK8sNativeMapping("myapp.ext.grafana.app", "widgets", "buttons")
	actions := m.AllActions()

	expected := []string{
		"myapp.ext.grafana.app/widgets/buttons:create",
		"myapp.ext.grafana.app/widgets/buttons:delete",
		"myapp.ext.grafana.app/widgets/buttons:get",
		"myapp.ext.grafana.app/widgets/buttons:get_permissions",
		"myapp.ext.grafana.app/widgets/buttons:set_permissions",
		"myapp.ext.grafana.app/widgets/buttons:update",
	}

	sort.Strings(actions)
	assert.Equal(t, expected, actions)
}

func TestK8sNativeMapping_DifferentGroups(t *testing.T) {
	// Two apps with the same resource name must produce distinct actions.
	m1 := newK8sNativeMapping("app1.ext.grafana.app", "widgets", "")
	m2 := newK8sNativeMapping("app2.ext.grafana.app", "widgets", "")

	action1, ok1 := m1.Action(utils.VerbGet)
	action2, ok2 := m2.Action(utils.VerbGet)

	require.True(t, ok1)
	require.True(t, ok2)
	assert.NotEqual(t, action1, action2, "different groups must produce distinct actions for the same resource")
	assert.Equal(t, "app1.ext.grafana.app/widgets:get", action1)
	assert.Equal(t, "app2.ext.grafana.app/widgets:get", action2)
}

func TestActionVerb(t *testing.T) {
	for verb, want := range map[string]string{
		utils.VerbGet:              "get",
		utils.VerbList:             "get",
		utils.VerbWatch:            "get",
		utils.VerbCreate:           "create",
		utils.VerbUpdate:           "update",
		utils.VerbPatch:            "update",
		utils.VerbDelete:           "delete",
		utils.VerbDeleteCollection: "delete",
		utils.VerbGetPermissions:   "get_permissions",
		utils.VerbSetPermissions:   "set_permissions",
	} {
		got, ok := ActionVerb(verb)
		assert.True(t, ok, "verb %q names no action", verb)
		assert.Equal(t, want, got, "verb %q", verb)
	}

	for _, verb := range []string{"", "read", "GET", "unknown"} {
		_, ok := ActionVerb(verb)
		assert.False(t, ok, "verb %q should name no action", verb)
	}
}

// Every request verb Grafana recognizes needs an action name. A verb missing
// here is not an error anywhere: a permission declared for it simply grants
// nothing, and the access check that would have used it silently denies.
func TestActionVerbCoversEveryValidVerb(t *testing.T) {
	for _, verb := range []string{
		utils.VerbGet, utils.VerbList, utils.VerbWatch, utils.VerbCreate, utils.VerbUpdate,
		utils.VerbPatch, utils.VerbDelete, utils.VerbDeleteCollection,
		utils.VerbGetPermissions, utils.VerbSetPermissions,
	} {
		require.True(t, utils.IsValidVerb(verb), "test list is stale: %q is not a valid verb", verb)
		_, ok := ActionVerb(verb)
		assert.True(t, ok, "valid verb %q names no RBAC action", verb)
	}

	for verb := range rbacVerbs {
		assert.True(t, utils.IsValidVerb(verb),
			"verb %q names an RBAC action but is not a valid request verb", verb)
	}
}

func TestActionVerbs(t *testing.T) {
	want := []string{"create", "delete", "get", "get_permissions", "set_permissions", "update"}
	assert.Equal(t, want, ActionVerbs(), "sorted and deduplicated")

	// The caller must not be able to edit the shared table.
	ActionVerbs()[0] = "mutated"
	assert.Equal(t, want, ActionVerbs())
}

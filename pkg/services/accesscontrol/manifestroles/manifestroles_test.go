package manifestroles

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
)

const testGroup = "example.ext.grafana.app"

var noLogs = &logging.NoOpLogger{}

func testManifest() *app.ManifestData {
	return &app.ManifestData{Group: testGroup, Versions: []app.ManifestVersion{
		{Name: "v1", Served: true, Kinds: []app.ManifestVersionKind{{Kind: "TestKind", Plural: "TestKinds", Resource: "testkinds", Scope: "Namespaced"}}},
		{Name: "v2", Served: true, Kinds: []app.ManifestVersionKind{
			{Kind: "TestKind", Plural: "TestKinds", Resource: "testkinds", Scope: "Namespaced"},
			// The resource, not the plural, is what storage registers and an action names.
			{Kind: "Person", Plural: "People", Resource: "people", Scope: "Namespaced"},
		}},
		{Name: "v0", Served: false, Kinds: []app.ManifestVersionKind{{Kind: "Legacy", Plural: "Legacies", Resource: "legacies", Scope: "Namespaced"}}},
	}}
}

func TestResourceNames(t *testing.T) {
	require.Equal(t, map[string]string{"TestKind": "testkinds", "Person": "people"}, ResourceNames(testManifest()),
		"only served kinds have a resource")
	require.Empty(t, ResourceNames(nil))

	manifest := testManifest()
	manifest.Versions[1].Kinds[1].Resource = ""
	require.Equal(t, map[string]string{"TestKind": "testkinds"}, ResourceNames(manifest),
		"a kind without a resource is not served")
}

func TestPermissionSetVerbs(t *testing.T) {
	viewer, ok := PermissionSetVerbs("Viewer")
	require.True(t, ok, "permission sets match case-insensitively")
	require.Equal(t, []string{"get", "list", "watch"}, viewer)

	admin, ok := PermissionSetVerbs(app.ManifestRolePermissionSetAdmin)
	require.True(t, ok)
	require.Contains(t, admin, "set_permissions")

	_, ok = PermissionSetVerbs("superuser")
	require.False(t, ok)

	viewer[0] = "delete"
	again, _ := PermissionSetVerbs("viewer")
	require.Equal(t, "get", again[0], "callers get a copy they may change")
}

func TestRoleActions(t *testing.T) {
	resources := ResourceNames(testManifest())
	set := func(s string) *string { return &s }
	actions := func(kinds ...app.ManifestRoleKind) []string {
		return RoleActions(testGroup, app.ManifestRole{Kinds: kinds}, resources, noLogs)
	}

	t.Run("verbs collapse onto the RBAC verbs authz checks", func(t *testing.T) {
		require.Equal(t, []string{
			testGroup + "/testkinds:create",
			testGroup + "/testkinds:get",
			testGroup + "/testkinds:update",
		}, actions(app.ManifestRoleKind{Kind: "TestKind", Verbs: []string{"get", "list", "watch", "create", "update", "patch"}}))
	})

	t.Run("permission sets", func(t *testing.T) {
		require.Equal(t, []string{testGroup + "/people:get"},
			actions(app.ManifestRoleKind{Kind: "Person", PermissionSet: set("viewer")}))
		require.Equal(t, []string{
			testGroup + "/testkinds:create",
			testGroup + "/testkinds:delete",
			testGroup + "/testkinds:get",
			testGroup + "/testkinds:update",
		}, actions(app.ManifestRoleKind{Kind: "TestKind", PermissionSet: set("editor")}))
		require.Contains(t, actions(app.ManifestRoleKind{Kind: "TestKind", PermissionSet: set("admin")}),
			testGroup+"/testkinds:set_permissions")
	})

	t.Run("verbs and permission sets mix within a role", func(t *testing.T) {
		require.Equal(t, []string{
			testGroup + "/testkinds/health:get",
			testGroup + "/testkinds:create",
			testGroup + "/testkinds:delete",
			testGroup + "/testkinds:get",
			testGroup + "/testkinds:update",
		}, actions(
			app.ManifestRoleKind{Kind: "TestKind", PermissionSet: set("editor")},
			app.ManifestRoleKind{Kind: "TestKind/health", Verbs: []string{"get"}},
			app.ManifestRoleKind{Kind: "TestKind", Verbs: []string{"get"}},
		), "sorted and deduplicated across kinds")
	})

	// A role may grant a kind's custom route, which a route's declared check
	// names as a subresource; the built-in status and scale subresources are
	// not grantable, and neither is anything that is not one path segment.
	t.Run("custom route subresources", func(t *testing.T) {
		require.Equal(t, []string{
			testGroup + "/testkinds/render:get",
			testGroup + "/testkinds:get",
		}, actions(
			app.ManifestRoleKind{Kind: "TestKind", PermissionSet: set("viewer")},
			app.ManifestRoleKind{Kind: "TestKind/render", PermissionSet: set("viewer")},
			app.ManifestRoleKind{Kind: "TestKind/status", PermissionSet: set("viewer")},
			app.ManifestRoleKind{Kind: "TestKind/Scale", PermissionSet: set("viewer")},
			app.ManifestRoleKind{Kind: "TestKind/", PermissionSet: set("viewer")},
			app.ManifestRoleKind{Kind: "TestKind/render/page", PermissionSet: set("viewer")},
		))
	})

	t.Run("what cannot name a checked action is skipped", func(t *testing.T) {
		require.Empty(t, actions(app.ManifestRoleKind{Kind: "Missing", Verbs: []string{"get"}}), "unknown kind")
		require.Empty(t, actions(app.ManifestRoleKind{Kind: "Legacy", Verbs: []string{"get"}}), "kind no served version declares")
		require.Empty(t, actions(app.ManifestRoleKind{Kind: "TestKind", PermissionSet: set("superuser")}), "unknown permission set")
		require.Empty(t, actions(app.ManifestRoleKind{Kind: "TestKind"}), "neither verbs nor a permission set")
		require.Equal(t, []string{testGroup + "/testkinds:delete"},
			actions(app.ManifestRoleKind{Kind: "TestKind", Verbs: []string{"exec", "delete"}}),
			"an unknown verb drops only that verb")
		require.Empty(t, actions(), "a role with no kinds grants nothing")
	})
}

func TestVerbActions(t *testing.T) {
	require.Equal(t, []string{
		testGroup + "/people:get",
		testGroup + "/testkinds:get",
	}, VerbActions(testGroup, []string{"testkinds", "people"}, []string{"list", "get", "bogus"}, noLogs))
	require.Empty(t, VerbActions(testGroup, nil, []string{"get"}, noLogs))
}

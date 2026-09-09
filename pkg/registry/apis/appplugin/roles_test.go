package appplugin

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

const testRoleGroup = "example.ext.grafana.app"

// actions is the list a registration grants, which is all that decides whether
// unified storage lets a request through.
func actions(t *testing.T, reg ac.RoleRegistration) []string {
	t.Helper()

	out := make([]string, 0, len(reg.Role.Permissions))
	for _, p := range reg.Role.Permissions {
		require.Empty(t, p.Scope,
			"the folder-authz model only reads a scopeless grant as the stack role")
		out = append(out, p.Action)
	}
	return out
}

func byName(t *testing.T, regs []ac.RoleRegistration) map[string]ac.RoleRegistration {
	t.Helper()

	out := map[string]ac.RoleRegistration{}
	for _, reg := range regs {
		require.NotContains(t, out, reg.Role.Name, "duplicate role registration")
		out[reg.Role.Name] = reg
	}
	return out
}

// A manifest that declares no roles still has to be usable, so its kinds are
// granted through the basic roles and folder permissions decide the rest.
func TestManifestRoleRegistrationsDefaults(t *testing.T) {
	regs := manifestRoleRegistrations(testRoleGroup, "Example", testManifest(t))
	roles := byName(t, regs)

	reader, ok := roles["fixed:"+testRoleGroup+":reader"]
	require.True(t, ok, "got %v", roles)
	require.Equal(t, []string{"Viewer"}, reader.Grants)
	require.Equal(t, []string{testRoleGroup + "/testkinds:get"}, actions(t, reader))

	writer, ok := roles["fixed:"+testRoleGroup+":writer"]
	require.True(t, ok, "got %v", roles)
	require.Equal(t, []string{"Editor"}, writer.Grants)
	require.Equal(t, []string{
		testRoleGroup + "/testkinds:create",
		testRoleGroup + "/testkinds:delete",
		testRoleGroup + "/testkinds:get",
		testRoleGroup + "/testkinds:update",
	}, actions(t, writer), "the Kubernetes verbs collapse onto the RBAC verbs authz checks")

	require.Equal(t, "Example", writer.Role.Group, "roles are grouped by plugin in the UI")
}

// A manifest that declares roles gets those, named and bound as it asked.
func TestManifestRoleRegistrationsFromManifest(t *testing.T) {
	manifest := testManifest(t)
	editor := app.ManifestRolePermissionSetEditor
	manifest.Roles = map[string]app.ManifestRole{
		"testkind:reader": {
			Title: "TestKind reader",
			Kinds: []app.ManifestRoleKind{{Kind: "TestKind", Verbs: []string{"get", "list", "watch"}}},
		},
		"testkind:writer": {
			Kinds: []app.ManifestRoleKind{{Kind: "TestKind", PermissionSet: &editor}},
		},
	}
	manifest.RoleBindings = &app.ManifestRoleBindings{
		Viewer: []string{"testkind:reader"},
		Editor: []string{"testkind:reader", "testkind:writer"},
	}

	roles := byName(t, manifestRoleRegistrations(testRoleGroup, "Example", manifest))
	require.Len(t, roles, 2, "the defaults are not added on top of declared roles")

	reader := roles["fixed:"+testRoleGroup+":testkind:reader"]
	require.Equal(t, "TestKind reader", reader.Role.DisplayName)
	require.Equal(t, []string{"Viewer", "Editor"}, reader.Grants)
	require.Equal(t, []string{testRoleGroup + "/testkinds:get"}, actions(t, reader))

	writer := roles["fixed:"+testRoleGroup+":testkind:writer"]
	require.Equal(t, "testkind:writer", writer.Role.DisplayName, "the role name stands in for a missing title")
	require.Equal(t, []string{"Editor"}, writer.Grants)
	require.Contains(t, actions(t, writer), testRoleGroup+"/testkinds:create")
}

// Nothing a manifest can say may produce a registration access control refuses,
// or one that names an action no check ever asks for.
func TestManifestRoleRegistrationsSkipsUnusable(t *testing.T) {
	manifest := testManifest(t)
	unknownSet := "superuser"
	manifest.Roles = map[string]app.ManifestRole{
		"unknown-kind": {
			Kinds: []app.ManifestRoleKind{{Kind: "Missing", Verbs: []string{"get"}}},
		},
		"unknown-set": {
			Kinds: []app.ManifestRoleKind{{Kind: "TestKind", PermissionSet: &unknownSet}},
		},
		"unknown-verb": {
			Kinds: []app.ManifestRoleKind{{Kind: "TestKind", Verbs: []string{"exec", "delete"}}},
		},
	}
	manifest.RoleBindings = &app.ManifestRoleBindings{
		Viewer:     []string{"unknown-kind", "unknown-set", "unknown-verb"},
		Additional: map[string][]string{"anonymous": {"unknown-verb"}},
	}

	roles := byName(t, manifestRoleRegistrations(testRoleGroup, "Example", manifest))
	require.Len(t, roles, 1, "a role that grants nothing is dropped rather than registered empty")

	verb := roles["fixed:"+testRoleGroup+":unknown-verb"]
	require.Equal(t, []string{testRoleGroup + "/testkinds:delete"}, actions(t, verb))
	require.Equal(t, []string{"Viewer"}, verb.Grants, "the unsupported group is dropped, not the role")

	for _, reg := range roles {
		require.NoError(t, ac.ValidateFixedRole(reg.Role))
		require.NoError(t, ac.ValidateBuiltInRoles(reg.Grants))
	}
}

// Kinds that are never served, or that have no REST path, have no resource for
// an action to name.
func TestManifestRoleRegistrationsWithoutResources(t *testing.T) {
	require.Nil(t, manifestRoleRegistrations(testRoleGroup, "Example", nil),
		"a plugin without a manifest serves only settings, which storage does not check")

	manifest := testManifest(t)
	for i := range manifest.Versions {
		manifest.Versions[i].Served = false
	}
	require.Empty(t, manifestRoleRegistrations(testRoleGroup, "Example", manifest))

	manifest = testManifest(t)
	for i := range manifest.Versions {
		for j := range manifest.Versions[i].Kinds {
			manifest.Versions[i].Kinds[j].Plural = ""
		}
	}
	require.Empty(t, manifestRoleRegistrations(testRoleGroup, "Example", manifest))
}

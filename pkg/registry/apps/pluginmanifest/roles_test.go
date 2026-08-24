package pluginmanifest

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

func ptr(s string) *string { return &s }

// manifestWithRoles builds manifest data serving a single kind, with the given roles/bindings.
func manifestWithRoles(roles map[string]app.ManifestRole, bindings *app.ManifestRoleBindings) *app.ManifestData {
	return &app.ManifestData{
		AppName: "testapp",
		Group:   "testapp.ext.grafana.com",
		Versions: []app.ManifestVersion{{
			Name: "v1",
			Kinds: []app.ManifestVersionKind{
				{Kind: "Thing", Plural: "things", Scope: "Namespaced"},
			},
		}},
		Roles:        roles,
		RoleBindings: bindings,
	}
}

// actionsOf collects the action strings of a registration, for order-insensitive comparison.
func actionsOf(reg accesscontrol.RoleRegistration) []string {
	actions := make([]string, 0, len(reg.Role.Permissions))
	for _, p := range reg.Role.Permissions {
		actions = append(actions, p.Action)
	}
	return actions
}

func TestRolesFromManifest(t *testing.T) {
	t.Run("returns nothing when the manifest declares no roles", func(t *testing.T) {
		regs, err := rolesFromManifest("test-plugin", manifestWithRoles(nil, nil))
		require.NoError(t, err)
		require.Empty(t, regs)
	})

	t.Run("returns nothing for nil manifest data", func(t *testing.T) {
		regs, err := rolesFromManifest("test-plugin", nil)
		require.NoError(t, err)
		require.Empty(t, regs)
	})

	t.Run("expands the viewer permission set to read-only actions", func(t *testing.T) {
		regs, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"reader": {
				Title: "Thing Reader",
				Kinds: []app.ManifestRoleKind{
					{Kind: "Thing", PermissionSet: ptr(app.ManifestRolePermissionSetViewer)},
				},
			},
		}, nil))
		require.NoError(t, err)
		require.Len(t, regs, 1)

		// get/list/watch all collapse onto the single "get" RBAC verb, so one action results.
		require.ElementsMatch(t, []string{"testapp.ext.grafana.com/things:get"}, actionsOf(regs[0]))
	})

	t.Run("expands the editor permission set to read and write actions", func(t *testing.T) {
		regs, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"editor": {
				Kinds: []app.ManifestRoleKind{
					{Kind: "Thing", PermissionSet: ptr(app.ManifestRolePermissionSetEditor)},
				},
			},
		}, nil))
		require.NoError(t, err)
		require.ElementsMatch(t, []string{
			"testapp.ext.grafana.com/things:get",
			"testapp.ext.grafana.com/things:create",
			"testapp.ext.grafana.com/things:update",
			"testapp.ext.grafana.com/things:delete",
		}, actionsOf(regs[0]))
	})

	t.Run("expands the admin permission set to include permission verbs", func(t *testing.T) {
		regs, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"admin": {
				Kinds: []app.ManifestRoleKind{
					{Kind: "Thing", PermissionSet: ptr(app.ManifestRolePermissionSetAdmin)},
				},
			},
		}, nil))
		require.NoError(t, err)
		require.ElementsMatch(t, []string{
			"testapp.ext.grafana.com/things:get",
			"testapp.ext.grafana.com/things:create",
			"testapp.ext.grafana.com/things:update",
			"testapp.ext.grafana.com/things:delete",
			"testapp.ext.grafana.com/things:get_permissions",
			"testapp.ext.grafana.com/things:set_permissions",
		}, actionsOf(regs[0]))
	})

	t.Run("maps explicit verbs and deduplicates collapsed ones", func(t *testing.T) {
		regs, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"custom": {
				// list and watch both collapse to "get", so the action must appear once.
				Kinds: []app.ManifestRoleKind{
					{Kind: "Thing", Verbs: []string{"get", "list", "watch", "patch", "update"}},
				},
			},
		}, nil))
		require.NoError(t, err)
		require.ElementsMatch(t, []string{
			"testapp.ext.grafana.com/things:get",
			"testapp.ext.grafana.com/things:update",
		}, actionsOf(regs[0]))
	})

	t.Run("grants routes as subresource read actions", func(t *testing.T) {
		regs, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"reloader": {Routes: []string{"reload"}},
		}, nil))
		require.NoError(t, err)
		require.Len(t, regs, 1)
		require.ElementsMatch(t,
			[]string{"testapp.ext.grafana.com/things/reload:get"},
			actionsOf(regs[0]))
	})

	t.Run("names the role and carries title and description", func(t *testing.T) {
		regs, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"reader": {
				Title:       "Thing Reader",
				Description: "Read things.",
				Kinds: []app.ManifestRoleKind{
					{Kind: "Thing", PermissionSet: ptr(app.ManifestRolePermissionSetViewer)},
				},
			},
		}, nil))
		require.NoError(t, err)
		require.Equal(t, accesscontrol.FixedRolePrefix+"testapp.ext.grafana.com:reader", regs[0].Role.Name)
		require.Equal(t, "Thing Reader", regs[0].Role.DisplayName)
		require.Equal(t, "Read things.", regs[0].Role.Description)
		require.Equal(t, "test-plugin", regs[0].Role.Group)
	})

	t.Run("falls back to the role key when no title is set", func(t *testing.T) {
		regs, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"reader": {Kinds: []app.ManifestRoleKind{
				{Kind: "Thing", PermissionSet: ptr(app.ManifestRolePermissionSetViewer)},
			}},
		}, nil))
		require.NoError(t, err)
		require.Equal(t, "reader", regs[0].Role.DisplayName)
	})

	t.Run("registers permissions without a scope", func(t *testing.T) {
		// The K8s-native authz path reads a scopeless grant as the stack role for the
		// action; a scope would need its kind pre-registered, which plugins cannot do.
		regs, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"reader": {Kinds: []app.ManifestRoleKind{
				{Kind: "Thing", PermissionSet: ptr(app.ManifestRolePermissionSetViewer)},
			}},
		}, nil))
		require.NoError(t, err)
		for _, p := range regs[0].Role.Permissions {
			require.Empty(t, p.Scope)
		}
	})

	t.Run("translates role bindings into basic role grants", func(t *testing.T) {
		roles := map[string]app.ManifestRole{
			"reader": {Kinds: []app.ManifestRoleKind{
				{Kind: "Thing", PermissionSet: ptr(app.ManifestRolePermissionSetViewer)},
			}},
			"writer": {Kinds: []app.ManifestRoleKind{
				{Kind: "Thing", PermissionSet: ptr(app.ManifestRolePermissionSetEditor)},
			}},
		}
		regs, err := rolesFromManifest("test-plugin", manifestWithRoles(roles, &app.ManifestRoleBindings{
			Viewer: []string{"reader"},
			Editor: []string{"reader", "writer"},
			Admin:  []string{"writer"},
		}))
		require.NoError(t, err)
		require.Len(t, regs, 2)

		byName := map[string][]string{}
		for _, r := range regs {
			byName[r.Role.Name] = r.Grants
		}
		require.ElementsMatch(t,
			[]string{string(org.RoleViewer), string(org.RoleEditor)},
			byName[accesscontrol.FixedRolePrefix+"testapp.ext.grafana.com:reader"])
		require.ElementsMatch(t,
			[]string{string(org.RoleEditor), string(org.RoleAdmin)},
			byName[accesscontrol.FixedRolePrefix+"testapp.ext.grafana.com:writer"])
	})

	t.Run("includes additional role bindings", func(t *testing.T) {
		regs, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"reader": {Kinds: []app.ManifestRoleKind{
				{Kind: "Thing", PermissionSet: ptr(app.ManifestRolePermissionSetViewer)},
			}},
		}, &app.ManifestRoleBindings{
			Additional: map[string][]string{"Admin": {"reader"}},
		}))
		require.NoError(t, err)
		require.Equal(t, []string{"Admin"}, regs[0].Grants)
	})

	t.Run("skips roles that resolve to no permissions", func(t *testing.T) {
		regs, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"empty": {Title: "Empty"},
		}, nil))
		require.NoError(t, err)
		require.Empty(t, regs)
	})

	t.Run("is deterministic across calls", func(t *testing.T) {
		md := manifestWithRoles(map[string]app.ManifestRole{
			"a": {Kinds: []app.ManifestRoleKind{{Kind: "Thing", Verbs: []string{"get"}}}},
			"b": {Kinds: []app.ManifestRoleKind{{Kind: "Thing", Verbs: []string{"get"}}}},
			"c": {Kinds: []app.ManifestRoleKind{{Kind: "Thing", Verbs: []string{"get"}}}},
		}, nil)
		first, err := rolesFromManifest("test-plugin", md)
		require.NoError(t, err)
		for i := 0; i < 5; i++ {
			again, err := rolesFromManifest("test-plugin", md)
			require.NoError(t, err)
			require.Equal(t, first, again)
		}
	})

	t.Run("errors when a role references an unknown kind", func(t *testing.T) {
		_, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"bad": {Kinds: []app.ManifestRoleKind{{Kind: "Missing", Verbs: []string{"get"}}}},
		}, nil))
		require.ErrorContains(t, err, `kind "Missing"`)
	})

	t.Run("errors on an unknown permission set", func(t *testing.T) {
		_, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"bad": {Kinds: []app.ManifestRoleKind{{Kind: "Thing", PermissionSet: ptr("superuser")}}},
		}, nil))
		require.ErrorContains(t, err, "unknown permissionSet")
	})

	t.Run("errors on an unsupported verb", func(t *testing.T) {
		_, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"bad": {Kinds: []app.ManifestRoleKind{{Kind: "Thing", Verbs: []string{"frobnicate"}}}},
		}, nil))
		require.ErrorContains(t, err, "unsupported verb")
	})

	t.Run("errors when verbs and permissionSet are both set", func(t *testing.T) {
		_, err := rolesFromManifest("test-plugin", manifestWithRoles(map[string]app.ManifestRole{
			"bad": {Kinds: []app.ManifestRoleKind{{
				Kind:          "Thing",
				Verbs:         []string{"get"},
				PermissionSet: ptr(app.ManifestRolePermissionSetViewer),
			}}},
		}, nil))
		require.ErrorContains(t, err, "mutually exclusive")
	})
}

func TestKindPlurals(t *testing.T) {
	t.Run("lowercases the declared plural", func(t *testing.T) {
		md := &app.ManifestData{Versions: []app.ManifestVersion{{
			Name:  "v1",
			Kinds: []app.ManifestVersionKind{{Kind: "Thing", Plural: "Things"}},
		}}}
		require.Equal(t, map[string]string{"Thing": "things"}, kindPlurals(md))
	})

	t.Run("derives a plural when the manifest omits one", func(t *testing.T) {
		md := &app.ManifestData{Versions: []app.ManifestVersion{{
			Name:  "v1",
			Kinds: []app.ManifestVersionKind{{Kind: "Thing"}},
		}}}
		require.Equal(t, map[string]string{"Thing": "things"}, kindPlurals(md))
	})

	t.Run("keeps the first plural for a kind served in several versions", func(t *testing.T) {
		md := &app.ManifestData{Versions: []app.ManifestVersion{
			{Name: "v1", Kinds: []app.ManifestVersionKind{{Kind: "Thing", Plural: "things"}}},
			{Name: "v2", Kinds: []app.ManifestVersionKind{{Kind: "Thing", Plural: "things"}}},
		}}
		require.Equal(t, map[string]string{"Thing": "things"}, kindPlurals(md))
	})
}

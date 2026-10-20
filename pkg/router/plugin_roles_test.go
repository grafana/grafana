package router

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	manifestroutes "github.com/grafana/grafana-app-sdk/routes"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/org"
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
	regs := manifestRoleRegistrations(testRoleGroup, "Example", roleTestManifest())
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
	manifest := roleTestManifest()
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
	require.Len(t, roles, 2, "a kind a declared role names gets no default roles")

	reader := roles["fixed:"+testRoleGroup+":testkind:reader"]
	require.Equal(t, "TestKind reader", reader.Role.DisplayName)
	require.Equal(t, []string{"Viewer", "Editor"}, reader.Grants)
	require.Equal(t, []string{testRoleGroup + "/testkinds:get"}, actions(t, reader))

	writer := roles["fixed:"+testRoleGroup+":testkind:writer"]
	require.Equal(t, "testkind:writer", writer.Role.DisplayName, "the role name stands in for a missing title")
	require.Equal(t, []string{"Editor"}, writer.Grants)
	require.Contains(t, actions(t, writer), testRoleGroup+"/testkinds:create")
}

// A role that grants only a kind's custom route is added to the default roles,
// and the defaults leave out only the kinds a declared role names itself.
func TestManifestRoleRegistrationsKeepsDefaults(t *testing.T) {
	manifest := roleTestManifest()
	for i := range manifest.Versions {
		manifest.Versions[i].Kinds = append(manifest.Versions[i].Kinds,
			app.ManifestVersionKind{Kind: "OtherKind", Plural: "OtherKinds", Scope: "Namespaced"})
	}
	viewer := app.ManifestRolePermissionSetViewer
	editor := app.ManifestRolePermissionSetEditor
	manifest.Roles = map[string]app.ManifestRole{
		"example:renderer":     {Kinds: []app.ManifestRoleKind{{Kind: "TestKind/render", PermissionSet: &editor}}},
		"example:other-reader": {Kinds: []app.ManifestRoleKind{{Kind: "OtherKind", PermissionSet: &viewer}}},
	}
	manifest.RoleBindings = &app.ManifestRoleBindings{
		Viewer: []string{"example:other-reader"},
		Admin:  []string{"example:renderer"},
	}

	roles := byName(t, manifestRoleRegistrations(testRoleGroup, "Example", manifest))
	require.Len(t, roles, 4)
	require.Equal(t, []string{testRoleGroup + "/testkinds:get"}, actions(t, roles["fixed:"+testRoleGroup+":reader"]),
		"OtherKind is named by a declared role, so it takes over that kind's access")
	require.NotContains(t, actions(t, roles["fixed:"+testRoleGroup+":writer"]), testRoleGroup+"/otherkinds:create")
	require.Contains(t, actions(t, roles["fixed:"+testRoleGroup+":writer"]), testRoleGroup+"/testkinds:create")
	require.Contains(t, actions(t, roles["fixed:"+testRoleGroup+":example:renderer"]), testRoleGroup+"/testkinds/render:create")
	require.Equal(t, []string{testRoleGroup + "/otherkinds:get"}, actions(t, roles["fixed:"+testRoleGroup+":example:other-reader"]))

	t.Run("a declared role named as a default replaces it", func(t *testing.T) {
		manifest := roleTestManifest()
		manifest.Roles = map[string]app.ManifestRole{
			"writer": {Kinds: []app.ManifestRoleKind{{Kind: "TestKind/render", PermissionSet: &editor}}},
		}
		manifest.RoleBindings = &app.ManifestRoleBindings{Admin: []string{"writer"}}

		roles := byName(t, manifestRoleRegistrations(testRoleGroup, "Example", manifest))
		require.Len(t, roles, 2)
		require.Equal(t, []string{"Viewer"}, roles["fixed:"+testRoleGroup+":reader"].Grants)
		writer := roles["fixed:"+testRoleGroup+":writer"]
		require.Equal(t, []string{"Admin"}, writer.Grants)
		require.NotContains(t, actions(t, writer), testRoleGroup+"/testkinds:create")
	})
}

// A route's declared access check is granted by a role kind naming the route,
// as the action the authz service derives for the check: here to admins only,
// while editors keep writing the kind itself through the default writer.
func TestManifestRoleRegistrationsGrantDeclaredRouteCheck(t *testing.T) {
	manifest := roleTestManifest()
	post := &spec3.Operation{}
	post.AddExtension(manifestroutes.ExtensionAuthzResource, "testkinds")
	post.AddExtension(manifestroutes.ExtensionAuthzSubresource, "expose")
	post.AddExtension(manifestroutes.ExtensionAuthzVerb, "create")
	manifest.Versions[1].OpenAPI.Paths = map[string]spec3.PathProps{
		"/namespaces/{namespace}/testkinds/{name}/expose": {Post: post},
	}
	editor := app.ManifestRolePermissionSetEditor
	manifest.Roles = map[string]app.ManifestRole{
		"example:exposer": {Title: "Exposer", Kinds: []app.ManifestRoleKind{{Kind: "TestKind/expose", PermissionSet: &editor}}},
	}
	manifest.RoleBindings = &app.ManifestRoleBindings{Admin: []string{"example:exposer"}}

	routes, problems := manifestroutes.Parse(manifest.Versions[1], manifestroutes.Options{})
	require.Empty(t, problems)
	require.Len(t, routes, 1)
	check := routes[0].Authz[http.MethodPost]
	// The action the authz service checks for a kind it holds no mapping for.
	verb, ok := rbac.ActionVerb(check.Verb)
	require.True(t, ok)
	action := testRoleGroup + "/" + check.Resource + "/" + check.Subresource + ":" + verb
	require.Equal(t, testRoleGroup+"/testkinds/expose:create", action)

	held := map[string][]string{}
	for _, reg := range manifestRoleRegistrations(testRoleGroup, "Example", manifest) {
		require.NoError(t, ac.ValidateFixedRole(reg.Role))
		for basic := range ac.BuiltInRolesWithParents(reg.Grants) {
			held[basic] = append(held[basic], actions(t, reg)...)
		}
	}
	require.Contains(t, held[string(org.RoleAdmin)], action)
	require.NotContains(t, held[string(org.RoleEditor)], action)
	require.Contains(t, held[string(org.RoleEditor)], testRoleGroup+"/testkinds:create")
}

// A role may grant a kind's custom route, which a route's declared check names
// as a subresource; the built-in status subresource is not grantable, and
// neither is anything that is not a single path segment.
func TestManifestRoleRegistrationsCustomRouteSubresource(t *testing.T) {
	manifest := roleTestManifest()
	viewer := app.ManifestRolePermissionSetViewer
	manifest.Roles = map[string]app.ManifestRole{
		"testkind:reader": {Kinds: []app.ManifestRoleKind{
			{Kind: "TestKind", PermissionSet: &viewer},
			{Kind: "TestKind/render", PermissionSet: &viewer},
			{Kind: "TestKind/status", PermissionSet: &viewer},
			{Kind: "TestKind/Scale", PermissionSet: &viewer},
			{Kind: "TestKind/", PermissionSet: &viewer},
			{Kind: "TestKind/render/page", PermissionSet: &viewer},
		}},
	}
	manifest.RoleBindings = &app.ManifestRoleBindings{Viewer: []string{"testkind:reader"}}

	roles := byName(t, manifestRoleRegistrations(testRoleGroup, "Example", manifest))
	require.ElementsMatch(t, []string{
		testRoleGroup + "/testkinds:get",
		testRoleGroup + "/testkinds/render:get",
	}, actions(t, roles["fixed:"+testRoleGroup+":testkind:reader"]))
}

// Nothing a manifest can say may produce a registration access control refuses,
// or one that names an action no check ever asks for.
func TestManifestRoleRegistrationsSkipsUnusable(t *testing.T) {
	manifest := roleTestManifest()
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

	manifest := roleTestManifest()
	for i := range manifest.Versions {
		manifest.Versions[i].Served = false
	}
	require.Empty(t, manifestRoleRegistrations(testRoleGroup, "Example", manifest))

	manifest = roleTestManifest()
	for i := range manifest.Versions {
		for j := range manifest.Versions[i].Kinds {
			manifest.Versions[i].Kinds[j].Plural = ""
		}
	}
	require.Empty(t, manifestRoleRegistrations(testRoleGroup, "Example", manifest))
}

func roleTestManifest() *app.ManifestData {
	return &app.ManifestData{Group: testRoleGroup, Versions: []app.ManifestVersion{
		{Name: "v1", Served: true, Kinds: []app.ManifestVersionKind{{Kind: "TestKind", Plural: "TestKinds", Scope: "Namespaced"}}},
		{Name: "v2", Served: true, Kinds: []app.ManifestVersionKind{{Kind: "TestKind", Plural: "TestKinds", Scope: "Namespaced"}}},
	}}
}

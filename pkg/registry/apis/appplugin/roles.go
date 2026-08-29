package appplugin

import (
	"maps"
	"slices"
	"strings"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

// Unified storage enforces RBAC on every group ending in .ext.grafana.app, and
// a group it holds no static mapping for is checked as "stack role AND folder
// permission": the caller must hold the scopeless <group>/<resource>:<verb>
// action, and their permission on the object's folder then decides. Nothing
// else grants that action -- a plugin cannot even declare it in plugin.json,
// since plugin actions must carry the plugin id as their prefix -- so these
// registrations are what make a plugin's kinds reachable at all.

// rbacVerbs maps the Kubernetes verbs a manifest role may name onto the RBAC
// verbs the authz service derives for an unmapped group. It mirrors k8sVerbMap
// in pkg/services/authz/rbac: a verb translated differently there would name an
// action no access check ever asks for.
var rbacVerbs = map[string]string{
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
}

var (
	viewerVerbs = []string{utils.VerbGet, utils.VerbList, utils.VerbWatch}
	editorVerbs = append(slices.Clone(viewerVerbs),
		utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch, utils.VerbDelete, utils.VerbDeleteCollection)
	adminVerbs = append(slices.Clone(editorVerbs),
		utils.VerbGetPermissions, utils.VerbSetPermissions)
)

// permissionSetVerbs expands the permission sets a manifest role may name
// instead of listing verbs itself.
var permissionSetVerbs = map[string][]string{
	app.ManifestRolePermissionSetViewer: viewerVerbs,
	app.ManifestRolePermissionSetEditor: editorVerbs,
	app.ManifestRolePermissionSetAdmin:  adminVerbs,
}

// basicRoles are the groups a manifest may bind a role to.
var basicRoles = map[string]string{
	"viewer": string(org.RoleViewer),
	"editor": string(org.RoleEditor),
	"admin":  string(org.RoleAdmin),
}

// declareManifestRoles registers the plugin's manifest roles with access
// control. It is a no-op for a plugin without a manifest, which serves only its
// settings API -- a group unified storage does not check.
func declareManifestRoles(service ac.Service, group, pluginName string, manifest *app.ManifestData) error {
	registrations := manifestRoleRegistrations(group, pluginName, manifest)
	if len(registrations) == 0 {
		return nil
	}
	return service.DeclareFixedRoles(registrations...)
}

// manifestRoleRegistrations converts a manifest's roles and role bindings into
// RBAC registrations.
//
// The manifest's own role names are used, so a plugin decides what its roles
// are called and who holds them. A manifest that declares no roles falls back
// to a reader and a writer role bound to the basic roles, so its kinds are
// usable without every plugin having to spell the same two roles out.
//
// ManifestRole.Routes is not converted: a custom route never reaches unified
// storage, so it is authorized by the plugin's app access alone.
func manifestRoleRegistrations(group, pluginName string, manifest *app.ManifestData) []ac.RoleRegistration {
	if manifest == nil {
		return nil
	}
	resources := kindResourceNames(manifest)
	if len(resources) == 0 {
		return nil
	}
	if len(manifest.Roles) == 0 {
		return defaultRoleRegistrations(group, pluginName, resources)
	}

	grants := roleGrants(group, manifest.RoleBindings)
	out := make([]ac.RoleRegistration, 0, len(manifest.Roles))
	// Sorted, so the same manifest always declares the same list.
	for _, name := range slices.Sorted(maps.Keys(manifest.Roles)) {
		role := manifest.Roles[name]
		permissions := rolePermissions(group, role, resources)
		if len(permissions) == 0 {
			logging.DefaultLogger.Warn("skipping manifest role that grants nothing",
				"group", group, "role", name)
			continue
		}
		displayName := role.Title
		if displayName == "" {
			displayName = name
		}
		out = append(out, ac.RoleRegistration{
			Role: ac.RoleDTO{
				Version:     1,
				Name:        roleName(group, name),
				DisplayName: displayName,
				Description: role.Description,
				Group:       pluginName,
				Permissions: permissions,
				OrgID:       ac.GlobalOrgID,
			},
			Grants: grants[name],
		})
	}
	return out
}

// defaultRoleRegistrations grants a manifest's kinds through the basic roles.
// Folder permissions still decide which objects a holder reaches, so this is
// the same shape as a dashboard: every viewer may read the kinds in folders
// they can view, and every editor may write them in folders they can edit.
func defaultRoleRegistrations(group, pluginName string, resources map[string]string) []ac.RoleRegistration {
	defaults := []struct {
		name        string
		displayName string
		description string
		verbs       []string
		grant       string
	}{
		{"reader", "Reader", "Read the kinds " + group + " serves", viewerVerbs, string(org.RoleViewer)},
		{"writer", "Writer", "Write the kinds " + group + " serves", editorVerbs, string(org.RoleEditor)},
	}

	out := make([]ac.RoleRegistration, 0, len(defaults))
	for _, d := range defaults {
		out = append(out, ac.RoleRegistration{
			Role: ac.RoleDTO{
				Version:     1,
				Name:        roleName(group, d.name),
				DisplayName: d.displayName,
				Description: d.description,
				Group:       pluginName,
				Permissions: permissionsFor(group, slices.Sorted(maps.Values(resources)), d.verbs),
				OrgID:       ac.GlobalOrgID,
			},
			Grants: []string{d.grant},
		})
	}
	return out
}

// rolePermissions converts one manifest role's kinds into RBAC permissions.
func rolePermissions(group string, role app.ManifestRole, resources map[string]string) []ac.Permission {
	seen := map[string]bool{}
	permissions := make([]ac.Permission, 0, len(role.Kinds))
	for _, kind := range role.Kinds {
		resource, ok := resources[kind.Kind]
		if !ok {
			logging.DefaultLogger.Warn("skipping manifest role kind that no served version declares",
				"group", group, "kind", kind.Kind)
			continue
		}
		for _, permission := range permissionsFor(group, []string{resource}, roleKindVerbs(group, kind)) {
			if seen[permission.Action] {
				continue
			}
			seen[permission.Action] = true
			permissions = append(permissions, permission)
		}
	}
	return permissions
}

// roleKindVerbs resolves the verbs a role grants on one kind, from the verbs it
// lists or the permission set it names.
func roleKindVerbs(group string, kind app.ManifestRoleKind) []string {
	if len(kind.Verbs) > 0 {
		return kind.Verbs
	}
	if kind.PermissionSet == nil {
		return nil
	}
	verbs, ok := permissionSetVerbs[strings.ToLower(*kind.PermissionSet)]
	if !ok {
		logging.DefaultLogger.Warn("skipping manifest role kind with an unknown permission set",
			"group", group, "kind", kind.Kind, "permissionSet", *kind.PermissionSet)
	}
	return verbs
}

// permissionsFor builds the scopeless actions the folder-authz model reads as
// the stack role. Sorted and deduplicated, since several Kubernetes verbs
// collapse onto one RBAC verb.
func permissionsFor(group string, resources []string, verbs []string) []ac.Permission {
	actions := map[string]bool{}
	for _, resource := range resources {
		for _, verb := range verbs {
			rbacVerb, ok := rbacVerbs[verb]
			if !ok {
				logging.DefaultLogger.Warn("skipping manifest role verb Grafana does not authorize",
					"group", group, "resource", resource, "verb", verb)
				continue
			}
			actions[group+"/"+resource+":"+rbacVerb] = true
		}
	}

	permissions := make([]ac.Permission, 0, len(actions))
	for _, action := range slices.Sorted(maps.Keys(actions)) {
		// A scopeless grant is what checkPermissionWithFolderAuthz reads as the
		// stack role; a wildcard scope collapses to "*" instead and is not one.
		permissions = append(permissions, ac.Permission{Action: action})
	}
	return permissions
}

// roleGrants inverts the manifest's role bindings into the basic roles each
// role is granted to. Grafana's basic roles inherit, so binding to viewer also
// reaches editors and admins.
func roleGrants(group string, bindings *app.ManifestRoleBindings) map[string][]string {
	if bindings == nil {
		return nil
	}
	grants := map[string][]string{}
	for _, binding := range []struct {
		group string
		roles []string
	}{
		{"viewer", bindings.Viewer},
		{"editor", bindings.Editor},
		{"admin", bindings.Admin},
	} {
		for _, role := range binding.roles {
			basic := basicRoles[binding.group]
			if !slices.Contains(grants[role], basic) {
				grants[role] = append(grants[role], basic)
			}
		}
	}
	// Additional binds roles to groups that are not Grafana basic roles, which
	// RBAC has nothing to map them onto.
	for name := range bindings.Additional {
		logging.DefaultLogger.Warn("ignoring manifest role binding for an unsupported group",
			"group", group, "boundTo", name)
	}
	return grants
}

// kindResourceNames maps each kind a served version declares to the resource
// name its storage is registered under, which is what an RBAC action names.
func kindResourceNames(manifest *app.ManifestData) map[string]string {
	resources := map[string]string{}
	for _, version := range manifest.Versions {
		if !version.Served {
			continue
		}
		for _, kind := range version.Kinds {
			if kind.Plural == "" {
				continue // newKindStore refuses these, so they have no resource
			}
			resources[kind.Kind] = strings.ToLower(kind.Plural)
		}
	}
	return resources
}

// roleName qualifies a manifest role name with the group it grants access to,
// so two plugins may both declare a role called "reader".
func roleName(group, name string) string {
	return ac.FixedRolePrefix + group + ":" + name
}

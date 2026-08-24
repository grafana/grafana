package pluginmanifest

import (
	"fmt"
	"sort"
	"strings"

	"github.com/grafana/grafana-app-sdk/app"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

// Roles declared in a plugin's app-sdk manifest are translated into Grafana RBAC fixed roles
// here. Without this, a manifest app's kinds are served but no role grants the actions the
// authorizer checks, so every request from a non-admin identity is denied and the APIs are
// unusable.
//
// Actions must match what the authz layer derives for these kinds. Plugin-manifest groups are
// not in the static RBAC mapper (pkg/services/authz/rbac/mapper.go), so checks fall through to
// the K8s-native mapping, which builds actions as "<group>/<resource>:<rbacVerb>" over a
// collapsed verb set (list/watch -> get, patch -> update, deletecollection -> delete). The
// permission set below is generated with the same rules so grants and checks line up exactly.

// k8sVerbToRBACVerb mirrors k8sVerbMap in pkg/services/authz/rbac/k8s_native_mapping.go.
// Several Kubernetes verbs collapse onto one RBAC verb.
var k8sVerbToRBACVerb = map[string]string{
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

// permissionSetVerbs expands the manifest's named permission sets (viewer/editor/admin) into
// Kubernetes verbs. A role kind may use a permission set instead of listing verbs explicitly.
var permissionSetVerbs = map[string][]string{
	app.ManifestRolePermissionSetViewer: {utils.VerbGet, utils.VerbList, utils.VerbWatch},
	app.ManifestRolePermissionSetEditor: {
		utils.VerbGet, utils.VerbList, utils.VerbWatch,
		utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch, utils.VerbDelete,
	},
	app.ManifestRolePermissionSetAdmin: {
		utils.VerbGet, utils.VerbList, utils.VerbWatch,
		utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch, utils.VerbDelete,
		utils.VerbDeleteCollection, utils.VerbGetPermissions, utils.VerbSetPermissions,
	},
}

// rolesFromManifest converts the Roles/RoleBindings of a plugin's manifest into RBAC role
// registrations. Roles with no resolvable permissions are skipped rather than registered empty.
func rolesFromManifest(pluginID string, md *app.ManifestData) ([]accesscontrol.RoleRegistration, error) {
	if md == nil || len(md.Roles) == 0 {
		return nil, nil
	}

	// Resolving a role's kinds to resources needs the kind -> plural mapping from the versions.
	plurals := kindPlurals(md)
	grants := grantsByRole(md.RoleBindings)

	// Iterate role names in sorted order so the registrations (and any resulting error) are
	// deterministic regardless of map ordering.
	names := make([]string, 0, len(md.Roles))
	for name := range md.Roles {
		names = append(names, name)
	}
	sort.Strings(names)

	regs := make([]accesscontrol.RoleRegistration, 0, len(names))
	for _, name := range names {
		role := md.Roles[name]
		perms, err := permissionsForRole(md.Group, name, role, plurals)
		if err != nil {
			return nil, err
		}
		if len(perms) == 0 {
			continue
		}
		regs = append(regs, accesscontrol.RoleRegistration{
			Role: accesscontrol.RoleDTO{
				Name:        roleName(md.Group, name),
				DisplayName: displayName(role.Title, name),
				Description: role.Description,
				Group:       pluginID,
				Version:     1,
				Permissions: perms,
			},
			Grants: grants[name],
		})
	}
	return regs, nil
}

// permissionsForRole builds the deduplicated permission list for a single manifest role.
func permissionsForRole(
	group, roleName string,
	role app.ManifestRole,
	plurals map[string]string,
) ([]accesscontrol.Permission, error) {
	seen := make(map[string]struct{})
	perms := make([]accesscontrol.Permission, 0)

	for _, rk := range role.Kinds {
		verbs, err := verbsForRoleKind(roleName, rk)
		if err != nil {
			return nil, err
		}
		resource, ok := plurals[rk.Kind]
		if !ok {
			return nil, fmt.Errorf("role %q references kind %q which is not served by the manifest", roleName, rk.Kind)
		}
		for _, verb := range verbs {
			rbacVerb, ok := k8sVerbToRBACVerb[verb]
			if !ok {
				return nil, fmt.Errorf("role %q: kind %q: unsupported verb %q", roleName, rk.Kind, verb)
			}
			action := group + "/" + resource + ":" + rbacVerb
			if _, dup := seen[action]; dup {
				continue
			}
			seen[action] = struct{}{}
			// Registered without a scope on purpose. The K8s-native authz path reads a
			// scopeless grant as the "stack role" for the action (scopeMap[""]), and any
			// folder-level narrowing is applied separately by that same path. A scope here
			// would also need its kind pre-registered in the permission registry, which
			// plugin-defined groups have no way to do.
			perms = append(perms, accesscontrol.Permission{Action: action})
		}
	}

	// Custom routes are addressed as subresources of their kind, so a route grant is the
	// "get" action on "<resource>/<route>". The manifest lists route names only, so the
	// grant covers the route across every kind and version that declares it.
	for _, route := range role.Routes {
		for _, action := range routeActions(group, route, plurals) {
			if _, dup := seen[action]; dup {
				continue
			}
			seen[action] = struct{}{}
			perms = append(perms, accesscontrol.Permission{Action: action})
		}
	}

	return perms, nil
}

// verbsForRoleKind resolves the Kubernetes verbs a role kind grants. Verbs and PermissionSet are
// mutually exclusive per the manifest schema.
func verbsForRoleKind(roleName string, rk app.ManifestRoleKind) ([]string, error) {
	hasVerbs := len(rk.Verbs) > 0
	hasSet := rk.PermissionSet != nil && *rk.PermissionSet != ""

	switch {
	case hasVerbs && hasSet:
		return nil, fmt.Errorf("role %q: kind %q sets both verbs and permissionSet, which are mutually exclusive", roleName, rk.Kind)
	case hasVerbs:
		return rk.Verbs, nil
	case hasSet:
		verbs, ok := permissionSetVerbs[*rk.PermissionSet]
		if !ok {
			return nil, fmt.Errorf("role %q: kind %q: unknown permissionSet %q", roleName, rk.Kind, *rk.PermissionSet)
		}
		return verbs, nil
	default:
		return nil, nil
	}
}

// routeActions returns the read actions for a named custom route across the kinds that declare
// it. Routes are served as subresources, so they are authorized as "<resource>/<route>".
func routeActions(group, route string, plurals map[string]string) []string {
	if route == "" {
		return nil
	}
	resources := make([]string, 0, len(plurals))
	for _, resource := range plurals {
		resources = append(resources, resource)
	}
	sort.Strings(resources)

	actions := make([]string, 0, len(resources))
	for _, resource := range resources {
		actions = append(actions, group+"/"+resource+"/"+route+":get")
	}
	return actions
}

// kindPlurals maps each kind served by the manifest to the resource (plural) name used in
// request paths, which is what the authz action is built from. A kind may appear in several
// versions; the plural is expected to be stable across them.
func kindPlurals(md *app.ManifestData) map[string]string {
	plurals := make(map[string]string)
	for _, v := range md.Versions {
		for _, k := range v.Kinds {
			if _, ok := plurals[k.Kind]; ok {
				continue
			}
			plural := k.Plural
			if plural == "" {
				plural = k.Kind + "s"
			}
			plurals[k.Kind] = strings.ToLower(plural)
		}
	}
	return plurals
}

// grantsByRole inverts the manifest's role bindings into a role -> basic roles map, which is the
// direction accesscontrol.RoleRegistration expects.
func grantsByRole(rb *app.ManifestRoleBindings) map[string][]string {
	grants := make(map[string][]string)
	if rb == nil {
		return grants
	}

	add := func(basicRole string, roles []string) {
		for _, role := range roles {
			grants[role] = append(grants[role], basicRole)
		}
	}
	add(string(org.RoleViewer), rb.Viewer)
	add(string(org.RoleEditor), rb.Editor)
	add(string(org.RoleAdmin), rb.Admin)
	// Additional bindings may name any basic role; unknown values are rejected downstream by
	// accesscontrol.ValidateBuiltInRoles rather than silently dropped here.
	additional := make([]string, 0, len(rb.Additional))
	for basicRole := range rb.Additional {
		additional = append(additional, basicRole)
	}
	sort.Strings(additional)
	for _, basicRole := range additional {
		add(basicRole, rb.Additional[basicRole])
	}
	return grants
}

// roleName builds the fixed-role name for a manifest role. The group is used rather than the
// plugin ID because the group is what the granted actions are namespaced by, keeping the role
// name and its permissions consistent.
func roleName(group, role string) string {
	return accesscontrol.FixedRolePrefix + group + ":" + role
}

func displayName(title, fallback string) string {
	if title != "" {
		return title
	}
	return fallback
}

// Package manifestroles converts the roles an app manifest declares into the
// RBAC actions they grant.
//
// Unified storage enforces RBAC on every group ending in .ext.grafana.app, and
// a group it holds no static mapping for is checked as "stack role AND folder
// permission": the caller must hold the scopeless <group>/<resource>:<verb>
// action, and their permission on the object's folder then decides. Nothing
// else grants that action, so whatever registers a manifest's roles, in process
// or as IAM resources, has to name the actions the same way. This package is
// that one conversion.
package manifestroles

import (
	"maps"
	"slices"
	"strings"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
)

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

// PermissionSetVerbs returns the Kubernetes verbs a permission set grants, and
// whether it is one. The name is matched case-insensitively.
func PermissionSetVerbs(set string) ([]string, bool) {
	verbs, ok := permissionSetVerbs[strings.ToLower(set)]
	return slices.Clone(verbs), ok
}

// ResourceNames maps each kind a served version declares to the resource name
// its storage is registered under, which is what an RBAC action names. Kinds
// without a resource are left out, since nothing serves them.
func ResourceNames(manifest *app.ManifestData) map[string]string {
	resources := map[string]string{}
	if manifest == nil {
		return resources
	}
	for _, version := range manifest.Versions {
		if !version.Served {
			continue
		}
		for _, kind := range version.Kinds {
			if kind.Resource == "" {
				continue // kindstore.New refuses these, so they have no resource
			}
			resources[kind.Kind] = kind.Resource
		}
	}
	return resources
}

// RoleActions returns the scopeless RBAC actions one manifest role grants,
// sorted and deduplicated. resources is the manifest's ResourceNames.
//
// A role kind lists Kubernetes verbs or names a permission set. It may name a
// kind's custom route, as Kind/<route>, which grants the <resource>/<route>
// subresource a route's declared access check asks for.
//
// Anything that cannot name an action some check asks for is logged and
// skipped rather than failing the role: a kind no served version declares, a
// built-in or malformed subresource, an unknown permission set, and a verb
// Grafana does not authorize. A role whose kinds all fall out grants nothing,
// and its caller decides what to do with it.
func RoleActions(group string, role app.ManifestRole, resources map[string]string, logger logging.Logger) []string {
	actions := map[string]bool{}
	for _, kind := range role.Kinds {
		base, sub, isSub := strings.Cut(kind.Kind, "/")
		resource, ok := resources[base]
		if !ok {
			logger.Warn("skipping manifest role kind that no served version declares",
				"group", group, "kind", kind.Kind)
			continue
		}
		if isSub {
			// A declared check names a subresource as one path segment, so
			// anything else would grant an action no check asks for.
			if sub == "" || strings.Contains(sub, "/") {
				logger.Warn("skipping manifest role kind that names no single custom route",
					"group", group, "kind", kind.Kind)
				continue
			}
			// Built-in subresources, not routes, so no declared check asks for
			// them, and users may not write status at all.
			if strings.EqualFold(sub, "status") || strings.EqualFold(sub, "scale") {
				logger.Warn("skipping manifest role kind that names a built-in subresource",
					"group", group, "kind", kind.Kind)
				continue
			}
			resource += "/" + sub
		}
		for _, action := range VerbActions(group, []string{resource}, kindVerbs(group, kind, logger), logger) {
			actions[action] = true
		}
	}
	return slices.Sorted(maps.Keys(actions))
}

// VerbActions returns the scopeless RBAC actions that grant verbs on
// resources, sorted and deduplicated, since several Kubernetes verbs collapse
// onto one RBAC verb.
func VerbActions(group string, resources []string, verbs []string, logger logging.Logger) []string {
	actions := map[string]bool{}
	for _, resource := range resources {
		for _, verb := range verbs {
			// The same table the authz service derives the action to check
			// from, so a verb it translates differently cannot name an action
			// no access check ever asks for.
			rbacVerb, ok := rbac.ActionVerb(verb)
			if !ok {
				logger.Warn("skipping manifest role verb Grafana does not authorize",
					"group", group, "resource", resource, "verb", verb)
				continue
			}
			actions[group+"/"+resource+":"+rbacVerb] = true
		}
	}
	return slices.Sorted(maps.Keys(actions))
}

// kindVerbs resolves the verbs a role grants on one kind, from the verbs it
// lists or the permission set it names.
func kindVerbs(group string, kind app.ManifestRoleKind, logger logging.Logger) []string {
	if len(kind.Verbs) > 0 {
		return kind.Verbs
	}
	if kind.PermissionSet == nil {
		return nil
	}
	verbs, ok := PermissionSetVerbs(*kind.PermissionSet)
	if !ok {
		logger.Warn("skipping manifest role kind with an unknown permission set",
			"group", group, "kind", kind.Kind, "permissionSet", *kind.PermissionSet)
	}
	return verbs
}

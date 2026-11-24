package router

import (
	"fmt"
	"maps"
	"slices"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/manifestroles"
	"github.com/grafana/grafana/pkg/services/org"
)

// These registrations are what make a plugin's kinds reachable at all: unified
// storage checks every .ext.grafana.app group for actions nothing else grants.
// manifestroles names the actions, so that the IAM roles cloud reconciles from
// the same manifests name them the same way.

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
	if service == nil {
		return fmt.Errorf("access control service is required to declare manifest roles")
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
// storage, so it is authorized by the plugin's app access and by any access
// check it declares, which the role kinds grant.
func manifestRoleRegistrations(group, pluginName string, manifest *app.ManifestData) []ac.RoleRegistration {
	if manifest == nil {
		return nil
	}
	resources := manifestroles.ResourceNames(manifest)
	if len(resources) == 0 {
		return nil
	}
	if len(manifest.Roles) == 0 {
		return defaultRoleRegistrations(group, pluginName, resources)
	}

	grants := roleGrants(group, manifest.RoleBindings)
	if len(grants) == 0 {
		// Every other degenerate case here warns; this one is the easiest to hit
		// by omission and the hardest to spot, since the roles do get registered
		// -- they just reach nobody until an administrator assigns them.
		logging.DefaultLogger.Warn("manifest declares roles but binds none to a basic role; its kinds are unreachable by default",
			"group", group)
	}
	out := make([]ac.RoleRegistration, 0, len(manifest.Roles))
	// Sorted, so the same manifest always declares the same list.
	for _, name := range slices.Sorted(maps.Keys(manifest.Roles)) {
		role := manifest.Roles[name]
		permissions := toPermissions(manifestroles.RoleActions(group, role, resources, logging.DefaultLogger))
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
		set         string
		grant       string
	}{
		{"reader", "Reader", "Read the kinds " + group + " serves", app.ManifestRolePermissionSetViewer, string(org.RoleViewer)},
		{"writer", "Writer", "Write the kinds " + group + " serves", app.ManifestRolePermissionSetEditor, string(org.RoleEditor)},
	}

	out := make([]ac.RoleRegistration, 0, len(defaults))
	for _, d := range defaults {
		verbs, _ := manifestroles.PermissionSetVerbs(d.set)
		out = append(out, ac.RoleRegistration{
			Role: ac.RoleDTO{
				Version:     1,
				Name:        roleName(group, d.name),
				DisplayName: d.displayName,
				Description: d.description,
				Group:       pluginName,
				Permissions: toPermissions(manifestroles.VerbActions(group, slices.Sorted(maps.Values(resources)), verbs, logging.DefaultLogger)),
				OrgID:       ac.GlobalOrgID,
			},
			Grants: []string{d.grant},
		})
	}
	return out
}

// toPermissions wraps actions as scopeless permissions: a scopeless grant is
// what checkPermissionWithFolderAuthz reads as the stack role; a wildcard scope
// collapses to "*" instead and is not one.
func toPermissions(actions []string) []ac.Permission {
	permissions := make([]ac.Permission, 0, len(actions))
	for _, action := range actions {
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

// roleName qualifies a manifest role name with the group it grants access to,
// so two plugins may both declare a role called "reader".
func roleName(group, name string) string {
	return ac.FixedRolePrefix + group + ":" + name
}

package legacyscopes

import (
	"strings"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

// Formatter expresses grant locations as UID scopes without IAM lookups.
type Formatter struct{}

// resourceScope scopes an object by the resource type Zanzana listed it under
// (e.g. "folders:uid:abc"), not by the action prefix, so permission actions like
// "folders.permissions:read" stay scoped on "folders:uid:<uid>".
func resourceScope(resource, name string) string {
	return ac.Scope(resource, "uid", name)
}

// resourceWildcardScope is the org-wide scope for the listed resource ("folders:*").
func resourceWildcardScope(resource string) string {
	return ac.Scope(resource, "*")
}

// folderScopeForLegacyRBAC returns a legacy RBAC scope for folder-scoped access (folders:uid:<uid>).
func folderScopeForLegacyRBAC(folderUID string) string {
	return ac.Scope("folders", "uid", folderUID)
}

// isDashboardRBACAction matches actions backed by the dashboard generic list path, which returns
// both direct dashboard objects (Items) and enclosing folders (Folders).
func isDashboardRBACAction(action string) bool {
	return strings.HasPrefix(action, "dashboards:")
}

// isTeamRBACAction matches team-management actions whose scopes need UID→ID translation.
func isTeamRBACAction(action string) bool {
	return strings.HasPrefix(action, "teams:") || strings.HasPrefix(action, "teams.")
}

// isUserRBACAction matches user-management actions, including the org.users:* family.
func isUserRBACAction(action string) bool {
	return strings.HasPrefix(action, "users:") || strings.HasPrefix(action, "users.") ||
		strings.HasPrefix(action, "org.users:")
}

// userScopeKind returns the legacy RBAC scope kind for a user-management action.
// Most user actions are server-level and scoped to global.users (users:read/write/delete and
// users.permissions:write all grant global.users:* in the fixed roles). The org-level
// exceptions, scoped to the users kind, are users.permissions:read (fixed:org.users:reader)
// and the org.users:* family (fixed:org.users:reader/writer).
func userScopeKind(action string) string {
	// users.permissions:read and the org.users:* family are org-scoped (the users kind);
	// the remaining user-management actions are server-level (global.users).
	if action == ac.ActionUsersPermissionsRead || strings.HasPrefix(action, "org.users:") {
		return "users"
	}
	return "global.users"
}

// Permissions formats grant locations. Numeric aliases are added by the permission loader.
func (r Formatter) Permissions(resource, action, scope string, resp *authzv1.ListResponse) []ac.Permission {
	permissions := []ac.Permission{}

	// Build the set of scopes that satisfy the filter: the exact scope plus
	// every wildcard that encompasses it (mirrors legacy RBAC semantics).
	// e.g. scope "folders:uid:abc" matches "folders:uid:abc", "folders:uid:*", "folders:*", "*".
	var scopeSet map[string]struct{}
	if scope != "" {
		wildcards := ac.WildcardsFromPrefix(ac.ScopePrefix(scope))
		scopeSet = make(map[string]struct{}, len(wildcards)+1)
		scopeSet[scope] = struct{}{}
		for _, w := range wildcards {
			scopeSet[w] = struct{}{}
		}
	}

	appendIfMatches := func(p ac.Permission) {
		if scope == "" {
			permissions = append(permissions, p)
			return
		}
		if _, ok := scopeSet[p.Scope]; ok {
			permissions = append(permissions, p)
		}
	}

	// If All is true, the user has access to all resources of this type.
	if resp.All {
		if isDashboardRBACAction(action) {
			// Legacy RBAC sometimes stores scope "*" for org-wide dashboard access. Only add it
			// when there is no scope filter: with a non-empty filter, "*" would match queries where
			// legacy rows only had dashboards:* / folders:* (see PermissionMatchesSearchOptions).
			if scope == "" {
				appendIfMatches(ac.Permission{
					Action: action,
					Scope:  "*",
				})
			}
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  resourceWildcardScope(resource),
			})
			// Generic dashboard list grants org-wide dashboard access; legacy RBAC also records
			// folder wildcard for the same action (see SearchUsersPermissions / Reduce).
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  ac.Scope("folders", "*"),
			})
		} else if isTeamRBACAction(action) {
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  ac.Scope("teams", "uid", "*"),
			})
		} else if isUserRBACAction(action) {
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  ac.Scope(userScopeKind(action), "uid", "*"),
			})
		} else {
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  resourceWildcardScope(resource),
			})
		}
	}

	for _, item := range resp.Items {
		kind := resource
		if isUserRBACAction(action) {
			kind = userScopeKind(action)
		}
		appendIfMatches(ac.Permission{Action: action, Scope: resourceScope(kind, item)})
	}

	// listGeneric on the Zanzana server returns folder UIDs separately; map them to folders:uid:*
	// scopes so they match legacy RBAC (not dashboards:uid:<folderUID>).
	for _, folderUID := range resp.Folders {
		appendIfMatches(ac.Permission{
			Action: action,
			Scope:  folderScopeForLegacyRBAC(folderUID),
		})
	}

	return permissions
}

package legacyscopes

import (
	"context"
	"errors"
	"fmt"
	"strings"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

var logger = log.New("accesscontrol.zanzana_scopes")

type IDResolver interface {
	GetTeamIDByUID(context.Context, types.NamespaceInfo, string) (int64, error)
	GetUserIDByUID(context.Context, types.NamespaceInfo, string) (int64, error)
}

// Formatter keeps permission RPC and permission-search results on the same legacy scope contract.
type Formatter struct{ IDs IDResolver }

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

// resolveTeamScope translates a team UID to the legacy teams:id:<numericID> scope.
func (r Formatter) resolveTeamScope(ctx context.Context, namespace, teamUID string) (string, error) {
	if r.IDs == nil {
		return "", errors.New("scope resolver not initialized")
	}
	nsInfo, err := types.ParseNamespace(namespace)
	if err != nil {
		return "", fmt.Errorf("failed to parse namespace: %w", err)
	}
	id, err := r.IDs.GetTeamIDByUID(ctx, nsInfo, teamUID)
	if err != nil {
		return "", err
	}
	return ac.Scope("teams", "id", fmt.Sprintf("%d", id)), nil
}

// teamWildcardScope returns the legacy wildcard scope for teams (teams:id:*).
func teamWildcardScope() string {
	return ac.Scope("teams", "id", "*")
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

// resolveUserScope translates a user UID to the legacy <kind>:id:<numericID> scope for the action.
func (r Formatter) resolveUserScope(ctx context.Context, namespace, action, userUID string) (string, error) {
	if r.IDs == nil {
		return "", errors.New("scope resolver not initialized")
	}
	nsInfo, err := types.ParseNamespace(namespace)
	if err != nil {
		return "", fmt.Errorf("failed to parse namespace: %w", err)
	}
	id, err := r.IDs.GetUserIDByUID(ctx, nsInfo, userUID)
	if err != nil {
		return "", err
	}
	return ac.Scope(userScopeKind(action), "id", fmt.Sprintf("%d", id)), nil
}

// userWildcardScope returns the legacy wildcard scope for a user action (<kind>:id:*).
func userWildcardScope(action string) string {
	return ac.Scope(userScopeKind(action), "id", "*")
}

// Permissions maps a Zanzana list result to legacy scopes, including the historical UID fallback.
func (r Formatter) Permissions(ctx context.Context, namespace, resource, action, scope string, resp *authzv1.ListResponse) []ac.Permission {
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
				Scope:  teamWildcardScope(),
			})
		} else if isUserRBACAction(action) {
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  userWildcardScope(action),
			})
		} else {
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  resourceWildcardScope(resource),
			})
		}
	}

	// Items are objects of the listed resource type, scoped by that resource.
	// Team and user actions need UID→ID translation so scopes match legacy RBAC
	// (teams:id:<n> / users:id:<n>).
	for _, item := range resp.Items {
		var itemScope string
		switch {
		case isTeamRBACAction(action):
			resolved, err := r.resolveTeamScope(ctx, namespace, item)
			if err != nil {
				logger.Warn("failed to resolve team UID to ID, using uid scope", "uid", item, "error", err)
				itemScope = resourceScope(resource, item)
			} else {
				itemScope = resolved
			}
		case isUserRBACAction(action):
			resolved, err := r.resolveUserScope(ctx, namespace, action, item)
			if err != nil {
				logger.Warn("failed to resolve user UID to ID, using uid scope", "uid", item, "error", err)
				itemScope = resourceScope(resource, item)
			} else {
				itemScope = resolved
			}
		default:
			itemScope = resourceScope(resource, item)
		}
		appendIfMatches(ac.Permission{
			Action: action,
			Scope:  itemScope,
		})
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

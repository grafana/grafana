package permissions

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
)

// maximum possible capacity for recursive queries array: one query for folder and one for dashboard actions
const maximumRecursiveQueries = 2

type clause struct {
	string
	params []any
}

type accessControlDashboardPermissionFilter struct {
	user             identity.Requester
	dashboardActions []string
	folderActions    []string
	features         featuremgmt.FeatureToggles

	where clause
	// any recursive CTE queries (if supported)
	recQueries                   []clause
	recursiveQueriesAreSupported bool
}

type PermissionsFilter interface {
	LeftJoin() string
	With() (string, []any)
	Where() (string, []any)

	buildClauses()
	nestedFoldersSelectors(permSelector string, permSelectorArgs []any, leftTableCol string, rightTableCol string) (string, []any)
}

// NewAccessControlDashboardPermissionFilter creates a new AccessControlDashboardPermissionFilter that is configured with specific actions calculated based on the dashboards.PermissionType and query type
// The filter is configured to use the new permissions filter (without subqueries) if the feature flag is enabled
// The filter is configured to use the old permissions filter (with subqueries) if the feature flag is disabled
func NewAccessControlDashboardPermissionFilter(user identity.Requester, permissionLevel dashboards.PermissionType, queryType string, features featuremgmt.FeatureToggles, recursiveQueriesAreSupported bool) PermissionsFilter {
	needEdit := permissionLevel > dashboards.PERMISSION_VIEW

	var folderActions []string
	var dashboardActions []string
	if queryType == searchstore.TypeFolder {
		folderActions = append(folderActions, dashboards.ActionFoldersRead)
		if needEdit {
			folderActions = append(folderActions, dashboards.ActionDashboardsCreate)
		}
	} else if queryType == searchstore.TypeDashboard {
		dashboardActions = append(dashboardActions, dashboards.ActionDashboardsRead)
		if needEdit {
			dashboardActions = append(dashboardActions, dashboards.ActionDashboardsWrite)
		}
	} else if queryType == searchstore.TypeAlertFolder {
		folderActions = append(
			folderActions,
			dashboards.ActionFoldersRead,
			accesscontrol.ActionAlertingRuleRead,
		)
		if needEdit {
			folderActions = append(
				folderActions,
				accesscontrol.ActionAlertingRuleCreate,
			)
		}
	} else {
		folderActions = append(folderActions, dashboards.ActionFoldersRead)
		dashboardActions = append(dashboardActions, dashboards.ActionDashboardsRead)
		if needEdit {
			folderActions = append(folderActions, dashboards.ActionDashboardsCreate)
			dashboardActions = append(dashboardActions, dashboards.ActionDashboardsWrite)
		}
	}

	var f PermissionsFilter
	if features.IsEnabled(featuremgmt.FlagPermissionsFilterRemoveSubquery) {
		f = &accessControlDashboardPermissionFilterNoFolderSubquery{
			accessControlDashboardPermissionFilter: accessControlDashboardPermissionFilter{
				user: user, folderActions: folderActions, dashboardActions: dashboardActions, features: features,
				recursiveQueriesAreSupported: recursiveQueriesAreSupported,
			},
		}
	} else {
		f = &accessControlDashboardPermissionFilter{user: user, folderActions: folderActions, dashboardActions: dashboardActions, features: features,
			recursiveQueriesAreSupported: recursiveQueriesAreSupported,
		}
	}
	f.buildClauses()
	return f
}

func (f *accessControlDashboardPermissionFilter) LeftJoin() string {
	return ""
}

// Where returns:
// - a where clause for filtering dashboards with expected permissions
// - an array with the query parameters
func (f *accessControlDashboardPermissionFilter) Where() (string, []any) {
	return f.where.string, f.where.params
}

func (f *accessControlDashboardPermissionFilter) buildClauses() {
	if f.user == nil || f.user.IsNil() || f.user.GetPermissions() == nil || len(f.user.GetPermissions()) == 0 {
		f.where = clause{string: "(1 = 0)"}
		return
	}
	dashWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeDashboardsPrefix)
	folderWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeFoldersPrefix)

	userID := int64(0)
	namespaceID, identifier := f.user.GetNamespacedID()
	switch namespaceID {
	case identity.NamespaceUser, identity.NamespaceServiceAccount:
		userID, _ = identity.IntIdentifier(namespaceID, identifier)
	}

	filter, params := accesscontrol.UserRolesFilter(f.user.GetOrgID(), userID, f.user.GetTeams(), accesscontrol.GetOrgRoles(f.user))
	rolesFilter := " AND role_id IN(SELECT id FROM role " + filter + ") "
	var args []any
	builder := strings.Builder{}
	builder.WriteRune('(')

	permSelector := strings.Builder{}
	var permSelectorArgs []any

	// useSelfContainedPermissions is true if the user's permissions are stored and set from the JWT token
	// currently it's used for the extended JWT module (when the user is authenticated via a JWT token generated by Grafana)
	useSelfContainedPermissions := f.user.GetAuthenticatedBy() == login.ExtendedJWTModule

	if len(f.dashboardActions) > 0 {
		toCheck := actionsToCheck(f.dashboardActions, f.user.GetPermissions(), dashWildcards, folderWildcards)

		if len(toCheck) > 0 {
			if !useSelfContainedPermissions {
				builder.WriteString("(dashboard.uid IN (SELECT substr(scope, 16) FROM permission WHERE scope LIKE 'dashboards:uid:%'")
				builder.WriteString(rolesFilter)
				args = append(args, params...)

				if len(toCheck) == 1 {
					builder.WriteString(" AND action = ?")
					args = append(args, toCheck[0])
				} else {
					builder.WriteString(" AND action IN (?" + strings.Repeat(", ?", len(toCheck)-1) + ") GROUP BY role_id, scope HAVING COUNT(action) = ?")
					args = append(args, toCheck...)
					args = append(args, len(toCheck))
				}
				builder.WriteString(") AND NOT dashboard.is_folder)")
			} else {
				actions := parseStringSliceFromInterfaceSlice(toCheck)

				args = getAllowedUIDs(actions, f.user, dashboards.ScopeDashboardsPrefix)

				// Only add the IN clause if we have any dashboards to check
				if len(args) > 0 {
					builder.WriteString("(dashboard.uid IN (?" + strings.Repeat(", ?", len(args)-1) + "")
					builder.WriteString(") AND NOT dashboard.is_folder)")
				} else {
					builder.WriteString("(1 = 0)")
				}
			}

			builder.WriteString(" OR ")

			if !useSelfContainedPermissions {
				permSelector.WriteString("(SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' ")
				permSelector.WriteString(rolesFilter)
				permSelectorArgs = append(permSelectorArgs, params...)

				if len(toCheck) == 1 {
					permSelector.WriteString(" AND action = ?")
					permSelectorArgs = append(permSelectorArgs, toCheck[0])
				} else {
					permSelector.WriteString(" AND action IN (?" + strings.Repeat(", ?", len(toCheck)-1) + ") GROUP BY role_id, scope HAVING COUNT(action) = ?")
					permSelectorArgs = append(permSelectorArgs, toCheck...)
					permSelectorArgs = append(permSelectorArgs, len(toCheck))
				}
			} else {
				actions := parseStringSliceFromInterfaceSlice(toCheck)

				permSelectorArgs = getAllowedUIDs(actions, f.user, dashboards.ScopeFoldersPrefix)

				// Only add the IN clause if we have any folders to check
				if len(permSelectorArgs) > 0 {
					permSelector.WriteString("(?" + strings.Repeat(", ?", len(permSelectorArgs)-1) + "")
				} else {
					permSelector.WriteString("(")
				}
			}
			permSelector.WriteRune(')')

			switch f.features.IsEnabled(featuremgmt.FlagNestedFolders) {
			case true:
				if len(permSelectorArgs) > 0 {
					switch f.recursiveQueriesAreSupported {
					case true:
						builder.WriteString("(dashboard.folder_id IN (SELECT d.id FROM dashboard as d ")
						recQueryName := fmt.Sprintf("RecQry%d", len(f.recQueries))
						f.addRecQry(recQueryName, permSelector.String(), permSelectorArgs)
						builder.WriteString(fmt.Sprintf("WHERE d.uid IN (SELECT uid FROM %s)", recQueryName))
					default:
						nestedFoldersSelectors, nestedFoldersArgs := f.nestedFoldersSelectors(permSelector.String(), permSelectorArgs, "dashboard.folder_id", "d.id")
						builder.WriteRune('(')
						builder.WriteString(nestedFoldersSelectors)
						args = append(args, nestedFoldersArgs...)
					}
				} else {
					builder.WriteString("(dashboard.folder_id IN (SELECT d.id FROM dashboard as d ")
					builder.WriteString("WHERE 1 = 0")
				}
			default:
				builder.WriteString("(dashboard.folder_id IN (SELECT d.id FROM dashboard as d ")
				if len(permSelectorArgs) > 0 {
					builder.WriteString("WHERE d.uid IN ")
					builder.WriteString(permSelector.String())
					args = append(args, permSelectorArgs...)
				} else {
					builder.WriteString("WHERE 1 = 0")
				}
			}
			builder.WriteString(") AND NOT dashboard.is_folder)")
		} else {
			builder.WriteString("NOT dashboard.is_folder")
		}
	}

	// recycle and reuse
	permSelector.Reset()
	permSelectorArgs = permSelectorArgs[:0]

	if len(f.folderActions) > 0 {
		if len(f.dashboardActions) > 0 {
			builder.WriteString(" OR ")
		}

		toCheck := actionsToCheck(f.folderActions, f.user.GetPermissions(), folderWildcards)
		if len(toCheck) > 0 {
			if !useSelfContainedPermissions {
				permSelector.WriteString("(SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%'")
				permSelector.WriteString(rolesFilter)
				permSelectorArgs = append(permSelectorArgs, params...)
				if len(toCheck) == 1 {
					permSelector.WriteString(" AND action = ?")
					permSelectorArgs = append(permSelectorArgs, toCheck[0])
				} else {
					permSelector.WriteString(" AND action IN (?" + strings.Repeat(", ?", len(toCheck)-1) + ") GROUP BY role_id, scope HAVING COUNT(action) = ?")
					permSelectorArgs = append(permSelectorArgs, toCheck...)
					permSelectorArgs = append(permSelectorArgs, len(toCheck))
				}
			} else {
				actions := parseStringSliceFromInterfaceSlice(toCheck)

				permSelectorArgs = getAllowedUIDs(actions, f.user, dashboards.ScopeFoldersPrefix)

				if len(permSelectorArgs) > 0 {
					permSelector.WriteString("(?" + strings.Repeat(", ?", len(permSelectorArgs)-1) + "")
				} else {
					permSelector.WriteString("(")
				}
			}

			permSelector.WriteRune(')')

			switch f.features.IsEnabled(featuremgmt.FlagNestedFolders) {
			case true:
				if len(permSelectorArgs) > 0 {
					switch f.recursiveQueriesAreSupported {
					case true:
						recQueryName := fmt.Sprintf("RecQry%d", len(f.recQueries))
						f.addRecQry(recQueryName, permSelector.String(), permSelectorArgs)
						builder.WriteString("(dashboard.uid IN ")
						builder.WriteString(fmt.Sprintf("(SELECT uid FROM %s)", recQueryName))
					default:
						nestedFoldersSelectors, nestedFoldersArgs := f.nestedFoldersSelectors(permSelector.String(), permSelectorArgs, "dashboard.uid", "d.uid")
						builder.WriteRune('(')
						builder.WriteString(nestedFoldersSelectors)
						builder.WriteRune(')')
						args = append(args, nestedFoldersArgs...)
					}
				} else {
					builder.WriteString("(1 = 0")
				}
			default:
				if len(permSelectorArgs) > 0 {
					builder.WriteString("(dashboard.uid IN ")
					builder.WriteString(permSelector.String())
					args = append(args, permSelectorArgs...)
				} else {
					builder.WriteString("(1 = 0")
				}
			}
			builder.WriteString(" AND dashboard.is_folder)")
		} else {
			builder.WriteString("dashboard.is_folder")
		}
	}

	builder.WriteRune(')')

	f.where = clause{string: builder.String(), params: args}
}

// With returns:
// - a with clause for fetching folders with inherited permissions if nested folders are enabled or an empty string
func (f *accessControlDashboardPermissionFilter) With() (string, []any) {
	var sb bytes.Buffer
	var params []any
	if len(f.recQueries) > 0 {
		sb.WriteString("WITH RECURSIVE ")
		sb.WriteString(f.recQueries[0].string)
		params = append(params, f.recQueries[0].params...)
		for _, r := range f.recQueries[1:] {
			sb.WriteRune(',')
			sb.WriteString(r.string)
			params = append(params, r.params...)
		}
	}
	return sb.String(), params
}

func (f *accessControlDashboardPermissionFilter) addRecQry(queryName string, whereUIDSelect string, whereParams []any) {
	if f.recQueries == nil {
		f.recQueries = make([]clause, 0, maximumRecursiveQueries)
	}
	c := make([]any, len(whereParams))
	copy(c, whereParams)
	f.recQueries = append(f.recQueries, clause{
		string: fmt.Sprintf(`%s AS (
			SELECT uid, parent_uid, org_id FROM folder WHERE uid IN %s
			UNION ALL SELECT f.uid, f.parent_uid, f.org_id FROM folder f INNER JOIN %s r ON f.parent_uid = r.uid and f.org_id = r.org_id
		)`, queryName, whereUIDSelect, queryName),
		params: c,
	})
}

func actionsToCheck(actions []string, permissions map[string][]string, wildcards ...accesscontrol.Wildcards) []any {
	toCheck := make([]any, 0, len(actions))

	for _, a := range actions {
		var hasWildcard bool

	outer:
		for _, scope := range permissions[a] {
			for _, w := range wildcards {
				if w.Contains(scope) {
					hasWildcard = true
					break outer
				}
			}
		}

		if !hasWildcard {
			toCheck = append(toCheck, a)
		}
	}
	return toCheck
}

func (f *accessControlDashboardPermissionFilter) nestedFoldersSelectors(permSelector string, permSelectorArgs []any, leftTableCol string, rightTableCol string) (string, []any) {
	wheres := make([]string, 0, folder.MaxNestedFolderDepth+1)
	args := make([]any, 0, len(permSelectorArgs)*(folder.MaxNestedFolderDepth+1))

	joins := make([]string, 0, folder.MaxNestedFolderDepth+2)

	tmpl := "INNER JOIN folder %s ON %s.%s = %s.uid AND %s.org_id = %s.org_id "

	prev := "d"
	onCol := "uid"
	for i := 1; i <= folder.MaxNestedFolderDepth+2; i++ {
		t := fmt.Sprintf("f%d", i)
		s := fmt.Sprintf(tmpl, t, prev, onCol, t, prev, t)
		joins = append(joins, s)

		wheres = append(wheres, fmt.Sprintf("(%s IN (SELECT %s FROM dashboard d %s WHERE %s.uid IN %s)", leftTableCol, rightTableCol, strings.Join(joins, " "), t, permSelector))
		args = append(args, permSelectorArgs...)

		prev = t
		onCol = "parent_uid"
	}

	return strings.Join(wheres, ") OR "), args
}

func parseStringSliceFromInterfaceSlice(slice []any) []string {
	result := make([]string, 0, len(slice))
	for _, s := range slice {
		result = append(result, s.(string))
	}
	return result
}

func getAllowedUIDs(actions []string, user identity.Requester, scopePrefix string) []any {
	uidToActions := make(map[string]map[string]struct{})
	for _, action := range actions {
		for _, uidScope := range user.GetPermissions()[action] {
			if !strings.HasPrefix(uidScope, scopePrefix) {
				continue
			}
			uid := strings.TrimPrefix(uidScope, scopePrefix)
			if _, exists := uidToActions[uid]; !exists {
				uidToActions[uid] = make(map[string]struct{})
			}
			uidToActions[uid][action] = struct{}{}
		}
	}

	// args max capacity is the length of the different uids
	args := make([]any, 0, len(uidToActions))
	for uid, assignedActions := range uidToActions {
		if len(assignedActions) == len(actions) {
			args = append(args, uid)
		}
	}
	return args
}

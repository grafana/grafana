package permissions

import (
	"bytes"
	"fmt"
	"slices"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
)

// maximum possible capacity for recursive queries array: one query for folder and one for dashboard actions
const maximumRecursiveQueries = 2

type clause struct {
	string
	params []any
}

type accessControlDashboardPermissionFilter struct {
	user                identity.Requester
	dashboardAction     string
	dashboardActionSets []string
	folderAction        string
	folderActionSets    []string
	features            featuremgmt.FeatureToggles

	where clause
	// any recursive CTE queries (if supported)
	recQueries                   []clause
	recursiveQueriesAreSupported bool
}

type PermissionsFilter interface {
	LeftJoin() string
	With() (string, []any)
	Where() (string, []any)

	buildClauses(dialect migrator.Dialect)
	nestedFoldersSelectors(permSelector string, permSelectorArgs []any, leftTable string, Col string, rightTableCol string, orgID int64) (string, []any)
}

// NewAccessControlDashboardPermissionFilter creates a new AccessControlDashboardPermissionFilter that is configured with specific actions calculated based on the dashboardaccess.PermissionType and query type
// The filter is configured to use the new permissions filter (without subqueries) if the feature flag is enabled
// The filter is configured to use the old permissions filter (with subqueries) if the feature flag is disabled
func NewAccessControlDashboardPermissionFilter(user identity.Requester, permissionLevel dashboardaccess.PermissionType, queryType string, features featuremgmt.FeatureToggles, recursiveQueriesAreSupported bool, dialect migrator.Dialect) PermissionsFilter {
	needEdit := permissionLevel > dashboardaccess.PERMISSION_VIEW

	var folderAction string
	var dashboardAction string
	var folderActionSets []string
	var dashboardActionSets []string
	switch queryType {
	case searchstore.TypeFolder:
		folderAction = dashboards.ActionFoldersRead
		folderActionSets = []string{"folders:view", "folders:edit", "folders:admin"}
		if needEdit {
			folderAction = dashboards.ActionDashboardsCreate
			folderActionSets = []string{"folders:edit", "folders:admin"}
		}
	case searchstore.TypeDashboard:
		dashboardAction = dashboards.ActionDashboardsRead
		folderActionSets = []string{"folders:view", "folders:edit", "folders:admin"}
		dashboardActionSets = []string{"dashboards:view", "dashboards:edit", "dashboards:admin"}
		if needEdit {
			dashboardAction = dashboards.ActionDashboardsWrite
			folderActionSets = []string{"folders:edit", "folders:admin"}
			dashboardActionSets = []string{"dashboards:edit", "dashboards:admin"}
		}
	case searchstore.TypeAlertFolder:
		folderAction = accesscontrol.ActionAlertingRuleRead
		folderActionSets = []string{"folders:view", "folders:edit", "folders:admin"}
		if needEdit {
			folderAction = accesscontrol.ActionAlertingRuleCreate
			folderActionSets = []string{"folders:edit", "folders:admin"}
		}
	case searchstore.TypeAnnotation:
		dashboardAction = accesscontrol.ActionAnnotationsRead
		folderActionSets = []string{"folders:view", "folders:edit", "folders:admin"}
		dashboardActionSets = []string{"dashboards:view", "dashboards:edit", "dashboards:admin"}
	default:
		folderAction = dashboards.ActionFoldersRead
		dashboardAction = dashboards.ActionDashboardsRead
		folderActionSets = []string{"folders:view", "folders:edit", "folders:admin"}
		dashboardActionSets = []string{"dashboards:view", "dashboards:edit", "dashboards:admin"}
		if needEdit {
			folderAction = dashboards.ActionDashboardsCreate
			dashboardAction = dashboards.ActionDashboardsWrite
			folderActionSets = []string{"folders:edit", "folders:admin"}
			dashboardActionSets = []string{"dashboards:edit", "dashboards:admin"}
		}
	}

	var f PermissionsFilter
	if features.IsEnabledGlobally(featuremgmt.FlagPermissionsFilterRemoveSubquery) {
		f = &accessControlDashboardPermissionFilterNoFolderSubquery{
			accessControlDashboardPermissionFilter: accessControlDashboardPermissionFilter{
				user: user, folderAction: folderAction, folderActionSets: folderActionSets, dashboardAction: dashboardAction, dashboardActionSets: dashboardActionSets,
				features: features, recursiveQueriesAreSupported: recursiveQueriesAreSupported,
			},
		}
	} else {
		f = &accessControlDashboardPermissionFilter{user: user, folderAction: folderAction, folderActionSets: folderActionSets, dashboardAction: dashboardAction, dashboardActionSets: dashboardActionSets,
			features: features, recursiveQueriesAreSupported: recursiveQueriesAreSupported,
		}
	}
	f.buildClauses(dialect)
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

// Check if user has no permissions required for search to skip expensive query
func (f *accessControlDashboardPermissionFilter) hasRequiredActions() bool {
	permissions := f.user.GetPermissions()
	requiredActions := []string{f.folderAction, f.dashboardAction}
	for _, action := range requiredActions {
		if _, ok := permissions[action]; ok {
			return true
		}
	}

	return false
}

func (f *accessControlDashboardPermissionFilter) buildClauses(dialect migrator.Dialect) {
	if f.user == nil || f.user.IsNil() || !f.hasRequiredActions() {
		f.where = clause{string: "(1 = 0)"}
		return
	}
	dashWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeDashboardsPrefix)
	folderWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeFoldersPrefix)

	var userID int64
	if id, err := identity.UserIdentifier(f.user.GetID()); err == nil {
		userID = id
	}

	orgID := f.user.GetOrgID()
	filter, params := accesscontrol.UserRolesFilter(orgID, userID, f.user.GetTeams(), accesscontrol.GetOrgRoles(f.user), dialect)
	rolesFilter := " AND role_id IN(SELECT id FROM role " + filter + ") "
	var args []any
	builder := strings.Builder{}
	builder.WriteRune('(')

	permSelector := strings.Builder{}
	var permSelectorArgs []any

	// useSelfContainedPermissions is true if the user's permissions are stored and set from the JWT token
	// currently it's used for the extended JWT module (when the user is authenticated via a JWT token generated by Grafana)
	useSelfContainedPermissions := f.user.IsAuthenticatedBy(login.ExtendedJWTModule)

	if f.dashboardAction != "" {
		toCheckDashboards := actionsToCheck(f.dashboardAction, f.dashboardActionSets, f.user.GetPermissions(), dashWildcards, folderWildcards)
		toCheckFolders := actionsToCheck(f.dashboardAction, f.folderActionSets, f.user.GetPermissions(), dashWildcards, folderWildcards)

		if len(toCheckDashboards) > 0 {
			if !useSelfContainedPermissions {
				builder.WriteString("(dashboard.uid IN (SELECT identifier FROM permission WHERE kind = 'dashboards' AND attribute = 'uid'")
				builder.WriteString(rolesFilter)
				args = append(args, params...)
				if len(toCheckDashboards) == 1 {
					builder.WriteString(" AND action = ?) AND NOT dashboard.is_folder)")
					args = append(args, toCheckDashboards[0])
				} else {
					builder.WriteString(" AND action IN (?" + strings.Repeat(", ?", len(toCheckDashboards)-1) + ")) AND NOT dashboard.is_folder)")
					args = append(args, toCheckDashboards...)
				}
			} else {
				args = getAllowedUIDs(f.dashboardAction, f.user, dashboards.ScopeDashboardsPrefix)

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
				permSelector.WriteString("(SELECT identifier FROM permission WHERE kind = 'folders' AND attribute = 'uid'")
				permSelector.WriteString(rolesFilter)
				permSelectorArgs = append(permSelectorArgs, params...)
				if len(toCheckDashboards) == 1 {
					permSelector.WriteString(" AND action = ?")
					permSelectorArgs = append(permSelectorArgs, toCheckDashboards[0])
				} else {
					permSelector.WriteString(" AND action IN (?" + strings.Repeat(", ?", len(toCheckDashboards)-1) + ")")
					permSelectorArgs = append(permSelectorArgs, toCheckFolders...)
				}
			} else {
				permSelectorArgs = getAllowedUIDs(f.dashboardAction, f.user, dashboards.ScopeFoldersPrefix)

				// Only add the IN clause if we have any folders to check
				if len(permSelectorArgs) > 0 {
					permSelector.WriteString("(?" + strings.Repeat(", ?", len(permSelectorArgs)-1) + "")
				} else {
					permSelector.WriteString("(")
				}
			}
			permSelector.WriteRune(')')

			switch f.features.IsEnabledGlobally(featuremgmt.FlagNestedFolders) {
			case true:
				if len(permSelectorArgs) > 0 {
					switch f.recursiveQueriesAreSupported {
					case true:
						builder.WriteString("(dashboard.folder_id IN (SELECT d.id FROM dashboard as d ")
						recQueryName := fmt.Sprintf("RecQry%d", len(f.recQueries))
						f.addRecQry(recQueryName, permSelector.String(), permSelectorArgs, orgID)
						builder.WriteString(fmt.Sprintf("WHERE d.org_id = ? AND d.uid IN (SELECT uid FROM %s)", recQueryName))
						args = append(args, orgID)
					default:
						nestedFoldersSelectors, nestedFoldersArgs := f.nestedFoldersSelectors(permSelector.String(), permSelectorArgs, "dashboard", "folder_id", "d.id", orgID)
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
					builder.WriteString("WHERE d.org_id = ? AND d.uid IN ")
					args = append(args, orgID)
					builder.WriteString(permSelector.String())
					args = append(args, permSelectorArgs...)
				} else {
					builder.WriteString("WHERE 1 = 0")
				}
			}
			builder.WriteString(") AND NOT dashboard.is_folder)")

			// Include all the dashboards under the root if the user has the required permissions on the root (used to be the General folder)
			if hasAccessToRoot(f.dashboardAction, f.user) {
				builder.WriteString(" OR (dashboard.folder_id = 0 AND NOT dashboard.is_folder)")
			}
		} else {
			builder.WriteString("NOT dashboard.is_folder")
		}
	}

	// recycle and reuse
	permSelector.Reset()
	permSelectorArgs = permSelectorArgs[:0]

	if f.folderAction != "" {
		if f.dashboardAction != "" {
			builder.WriteString(" OR ")
		}

		toCheck := actionsToCheck(f.folderAction, f.folderActionSets, f.user.GetPermissions(), folderWildcards)

		if len(toCheck) > 0 {
			if !useSelfContainedPermissions {
				permSelector.WriteString("(SELECT identifier FROM permission WHERE kind = 'folders' AND attribute = 'uid'")
				permSelector.WriteString(rolesFilter)
				permSelectorArgs = append(permSelectorArgs, params...)
				if len(toCheck) == 1 {
					permSelector.WriteString(" AND action = ?")
					permSelectorArgs = append(permSelectorArgs, toCheck[0])
				} else {
					permSelector.WriteString(" AND action IN (?" + strings.Repeat(", ?", len(toCheck)-1) + ")")
					permSelectorArgs = append(permSelectorArgs, toCheck...)
				}
			} else {
				permSelectorArgs = getAllowedUIDs(f.folderAction, f.user, dashboards.ScopeFoldersPrefix)

				if len(permSelectorArgs) > 0 {
					permSelector.WriteString("(?" + strings.Repeat(", ?", len(permSelectorArgs)-1) + "")
				} else {
					permSelector.WriteString("(")
				}
			}

			permSelector.WriteRune(')')

			switch f.features.IsEnabledGlobally(featuremgmt.FlagNestedFolders) {
			case true:
				if len(permSelectorArgs) > 0 {
					switch f.recursiveQueriesAreSupported {
					case true:
						recQueryName := fmt.Sprintf("RecQry%d", len(f.recQueries))
						f.addRecQry(recQueryName, permSelector.String(), permSelectorArgs, orgID)
						builder.WriteString("(dashboard.uid IN ")
						builder.WriteString(fmt.Sprintf("(SELECT uid FROM %s)", recQueryName))
					default:
						nestedFoldersSelectors, nestedFoldersArgs := f.nestedFoldersSelectors(permSelector.String(), permSelectorArgs, "dashboard", "uid", "d.uid", orgID)
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

func (f *accessControlDashboardPermissionFilter) addRecQry(queryName string, whereUIDSelect string, whereParams []any, orgID int64) {
	if f.recQueries == nil {
		f.recQueries = make([]clause, 0, maximumRecursiveQueries)
	}
	c := make([]any, len(whereParams))
	copy(c, whereParams)
	c = append([]any{orgID}, c...)
	f.recQueries = append(f.recQueries, clause{
		// covered by UQE_folder_org_id_uid and UQE_folder_org_id_parent_uid_title
		string: fmt.Sprintf(`%s AS (
			SELECT uid, parent_uid, org_id FROM folder WHERE org_id = ? AND uid IN %s
			UNION ALL SELECT f.uid, f.parent_uid, f.org_id FROM folder f INNER JOIN %s r ON f.parent_uid = r.uid and f.org_id = r.org_id
		)`, queryName, whereUIDSelect, queryName),
		params: c,
	})
}

func actionsToCheck(action string, actionSets []string, permissions map[string][]string, wildcards ...accesscontrol.Wildcards) []any {
	for _, scope := range permissions[action] {
		for _, w := range wildcards {
			if w.Contains(scope) {
				return []any{}
			}
		}
	}

	toCheck := []any{action}
	for _, a := range actionSets {
		toCheck = append(toCheck, a)
	}

	return toCheck
}

func (f *accessControlDashboardPermissionFilter) nestedFoldersSelectors(permSelector string, permSelectorArgs []any, leftTable string, leftCol string, rightTableCol string, orgID int64) (string, []any) {
	wheres := make([]string, 0, folder.MaxNestedFolderDepth+1)
	args := make([]any, 0, len(permSelectorArgs)*(folder.MaxNestedFolderDepth+1))

	joins := make([]string, 0, folder.MaxNestedFolderDepth+2)

	// covered by UQE_folder_org_id_uid
	tmpl := "INNER JOIN folder %s ON %s.%s = %s.uid AND %s.org_id = %s.org_id "

	prev := "d"
	onCol := "uid"
	for i := 1; i <= folder.MaxNestedFolderDepth+2; i++ {
		t := fmt.Sprintf("f%d", i)
		s := fmt.Sprintf(tmpl, t, prev, onCol, t, prev, t)
		joins = append(joins, s)

		// covered by UQE_folder_org_id_uid
		wheres = append(wheres, fmt.Sprintf("(%s.org_id = ? AND %s.%s IN (SELECT %s FROM dashboard d %s WHERE %s.org_id = ? AND %s.uid IN %s)", leftTable, leftTable, leftCol, rightTableCol, strings.Join(joins, " "), t, t, permSelector))
		args = append(args, orgID, orgID)
		args = append(args, permSelectorArgs...)

		prev = t
		onCol = "parent_uid"
	}

	return strings.Join(wheres, ") OR "), args
}

func getAllowedUIDs(action string, user identity.Requester, scopePrefix string) []any {
	uidScopes := user.GetPermissions()[action]

	args := make([]any, 0, len(uidScopes))
	for _, uidScope := range uidScopes {
		if !strings.HasPrefix(uidScope, scopePrefix) {
			continue
		}
		uid := strings.TrimPrefix(uidScope, scopePrefix)
		args = append(args, uid)
	}

	return args
}

// Checks if the user has the required permissions on the root (used to be the General folder)
func hasAccessToRoot(actionToCheck string, user identity.Requester) bool {
	generalFolderScope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.GeneralFolderUID)
	return slices.Contains(user.GetPermissions()[actionToCheck], generalFolderScope)
}

package permissions

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/user"
)

// maximum possible capacity for recursive queries array: one query for folder and one for dashboard actions
const maximumRecursiveQueries = 2

type DashboardPermissionFilter struct {
	OrgRole         org.RoleType
	Dialect         migrator.Dialect
	UserId          int64
	OrgId           int64
	PermissionLevel dashboards.PermissionType
}

func (d DashboardPermissionFilter) Where() (string, []interface{}) {
	if d.OrgRole == org.RoleAdmin {
		return "", nil
	}

	okRoles := []interface{}{d.OrgRole}
	if d.OrgRole == org.RoleEditor {
		okRoles = append(okRoles, org.RoleViewer)
	}

	falseStr := d.Dialect.BooleanStr(false)

	sql := `(
		dashboard.id IN (
			SELECT distinct DashboardId from (
				SELECT d.id AS DashboardId
					FROM dashboard AS d
					LEFT JOIN dashboard_acl AS da ON
						da.dashboard_id = d.id OR
						da.dashboard_id = d.folder_id
					WHERE
						d.org_id = ? AND
						da.permission >= ? AND
						(
							da.user_id = ? OR
							da.team_id IN (SELECT team_id from team_member AS tm WHERE tm.user_id = ?) OR
							da.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
						)
				UNION
				SELECT d.id AS DashboardId
					FROM dashboard AS d
					LEFT JOIN dashboard AS folder on folder.id = d.folder_id
					LEFT JOIN dashboard_acl AS da ON
						(
							-- include default permissions -->
							da.org_id = -1 AND (
							  (folder.id IS NOT NULL AND folder.has_acl = ` + falseStr + `) OR
							  (folder.id IS NULL AND d.has_acl = ` + falseStr + `)
							)
						)
					WHERE
						d.org_id = ? AND
						da.permission >= ? AND
						(
							da.user_id = ? OR
							da.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
						)
			) AS a
		)
	)
	`

	params := []interface{}{d.OrgId, d.PermissionLevel, d.UserId, d.UserId}
	params = append(params, okRoles...)
	params = append(params, d.OrgId, d.PermissionLevel, d.UserId)
	params = append(params, okRoles...)
	return sql, params
}

type clause struct {
	string
	params []interface{}
}

type accessControlDashboardPermissionFilter struct {
	user             *user.SignedInUser
	dashboardActions []string
	folderActions    []string
	features         featuremgmt.FeatureToggles

	where clause
	// any recursive CTE queries (if supported)
	recQueries                   []clause
	recursiveQueriesAreSupported bool
}

// NewAccessControlDashboardPermissionFilter creates a new AccessControlDashboardPermissionFilter that is configured with specific actions calculated based on the dashboards.PermissionType and query type
func NewAccessControlDashboardPermissionFilter(user *user.SignedInUser, permissionLevel dashboards.PermissionType, queryType string, features featuremgmt.FeatureToggles, recursiveQueriesAreSupported bool) *accessControlDashboardPermissionFilter {
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

	f := accessControlDashboardPermissionFilter{user: user, folderActions: folderActions, dashboardActions: dashboardActions, features: features,
		recursiveQueriesAreSupported: recursiveQueriesAreSupported,
	}

	f.buildClauses()

	return &f
}

// Where returns:
// - a where clause for filtering dashboards with expected permissions
// - an array with the query parameters
func (f *accessControlDashboardPermissionFilter) Where() (string, []interface{}) {
	return f.where.string, f.where.params
}

func (f *accessControlDashboardPermissionFilter) buildClauses() {
	if f.user == nil || f.user.Permissions == nil || f.user.Permissions[f.user.OrgID] == nil {
		f.where = clause{string: "(1 = 0)"}
		return
	}
	dashWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeDashboardsPrefix)
	folderWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeFoldersPrefix)

	rolesFilter, params := accesscontrol.UserRolesFilter(f.user.OrgID, f.user.UserID, f.user.Teams, accesscontrol.GetOrgRoles(f.user))
	var args []interface{}
	builder := strings.Builder{}
	builder.WriteRune('(')

	permSelector := strings.Builder{}
	var permSelectorArgs []interface{}

	if len(f.dashboardActions) > 0 {
		toCheck := actionsToCheck(f.dashboardActions, f.user.Permissions[f.user.OrgID], dashWildcards, folderWildcards)

		if len(toCheck) > 0 {
			builder.WriteString("(dashboard.uid IN (SELECT substr(scope, 16) FROM permission WHERE scope LIKE 'dashboards:uid:%' AND ")
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

			builder.WriteString(" OR ")
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

			switch f.features.IsEnabled(featuremgmt.FlagNestedFolders) {
			case true:
				switch f.recursiveQueriesAreSupported {
				case true:
					recQueryName := fmt.Sprintf("RecQry%d", len(f.recQueries))
					f.addRecQry(recQueryName, permSelector.String(), permSelectorArgs)
					builder.WriteString("(dashboard.folder_id IN (SELECT d.id FROM dashboard as d ")
					builder.WriteString(fmt.Sprintf("WHERE d.uid IN (SELECT uid FROM %s)", recQueryName))
				default:
					nestedFoldersSelectors, nestedFoldersArgs := nestedFoldersSelectors(permSelector.String(), permSelectorArgs, "folder_id", "id")
					builder.WriteRune('(')
					builder.WriteString(nestedFoldersSelectors)
					args = append(args, nestedFoldersArgs...)
				}
			default:
				builder.WriteString("(dashboard.folder_id IN (SELECT d.id FROM dashboard as d ")
				builder.WriteString("WHERE d.uid IN ")
				builder.WriteString("(SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND ")
				builder.WriteString(permSelector.String())
				builder.WriteRune(')')
				args = append(args, permSelectorArgs...)
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

		toCheck := actionsToCheck(f.folderActions, f.user.Permissions[f.user.OrgID], folderWildcards)
		if len(toCheck) > 0 {
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

			switch f.features.IsEnabled(featuremgmt.FlagNestedFolders) {
			case true:
				switch f.recursiveQueriesAreSupported {
				case true:
					recQueryName := fmt.Sprintf("RecQry%d", len(f.recQueries))
					f.addRecQry(recQueryName, permSelector.String(), permSelectorArgs)
					builder.WriteString("(dashboard.uid IN ")
					builder.WriteString(fmt.Sprintf("(SELECT uid FROM %s)", recQueryName))
				default:
					nestedFoldersSelectors, nestedFoldersArgs := nestedFoldersSelectors(permSelector.String(), permSelectorArgs, "uid", "uid")
					builder.WriteRune('(')
					builder.WriteString(nestedFoldersSelectors)
					builder.WriteRune(')')
					args = append(args, nestedFoldersArgs...)
				}
			default:
				builder.WriteString("(dashboard.uid IN ")
				builder.WriteString("(SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND ")
				builder.WriteString(permSelector.String())
				builder.WriteRune(')')
				args = append(args, permSelectorArgs...)
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
func (f *accessControlDashboardPermissionFilter) With() (string, []interface{}) {
	var sb bytes.Buffer
	var params []interface{}
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

func (f *accessControlDashboardPermissionFilter) addRecQry(queryName string, whereUIDSelect string, whereParams []interface{}) {
	if f.recQueries == nil {
		f.recQueries = make([]clause, 0, maximumRecursiveQueries)
	}
	c := make([]interface{}, len(whereParams))
	copy(c, whereParams)
	f.recQueries = append(f.recQueries, clause{
		string: fmt.Sprintf(`%s AS (
			SELECT uid, parent_uid, org_id FROM folder
			INNER JOIN permission on folder.uid = substr(permission.scope, 13) AND permission.scope LIKE '%s' AND %s
			UNION ALL SELECT f.uid, f.parent_uid, f.org_id FROM folder f INNER JOIN %s r ON f.parent_uid = r.uid and f.org_id = r.org_id
		)`, queryName, "folders:uid:%", whereUIDSelect, queryName),
		params: c,
	})
}

func actionsToCheck(actions []string, permissions map[string][]string, wildcards ...accesscontrol.Wildcards) []interface{} {
	toCheck := make([]interface{}, 0, len(actions))

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

func nestedFoldersSelectors(permSelector string, permSelectorArgs []interface{}, leftTableCol string, rightTableCol string) (string, []interface{}) {
	wheres := make([]string, 0, folder.MaxNestedFolderDepth+1)
	args := make([]interface{}, 0, len(permSelectorArgs)*(folder.MaxNestedFolderDepth+1))

	joins := make([]string, 0, folder.MaxNestedFolderDepth+2)

	tmpl := "INNER JOIN folder %s ON %s.%s = %s.uid AND %s.org_id = %s.org_id "

	prev := "d"
	onCol := "uid"
	for i := 1; i <= folder.MaxNestedFolderDepth+2; i++ {
		t := fmt.Sprintf("f%d", i)
		s := fmt.Sprintf(tmpl, t, prev, onCol, t, prev, t)
		joins = append(joins, s)

		wheres = append(wheres, fmt.Sprintf("(dashboard.%s IN (SELECT d.%s FROM dashboard d %s WHERE %s.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE '%s' AND %s))", leftTableCol, rightTableCol, strings.Join(joins, " "), t, "folders:uid:%", permSelector))
		args = append(args, permSelectorArgs...)

		prev = t
		onCol = "parent_uid"
	}

	return strings.Join(wheres, ") OR "), args
}

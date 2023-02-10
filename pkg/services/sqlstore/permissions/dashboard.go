package permissions

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/user"
)

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

type AccessControlDashboardPermissionFilter struct {
	user             *user.SignedInUser
	dashboardActions []string
	folderActions    []string
	features         featuremgmt.FeatureToggles
}

// NewAccessControlDashboardPermissionFilter creates a new AccessControlDashboardPermissionFilter that is configured with specific actions calculated based on the dashboards.PermissionType and query type
func NewAccessControlDashboardPermissionFilter(user *user.SignedInUser, permissionLevel dashboards.PermissionType, queryType string, features featuremgmt.FeatureToggles) AccessControlDashboardPermissionFilter {
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

	return AccessControlDashboardPermissionFilter{user: user, folderActions: folderActions, dashboardActions: dashboardActions, features: features}
}

// Where returns:
// - a recursive query for fetching folders with inherited permissions if nested folders are enabled or an empty string
// - a where clause for filtering dashboards with expected permissions
// - an array with the query parameters
func (f AccessControlDashboardPermissionFilter) Where() (string, string, []interface{}) {
	if f.user == nil || f.user.Permissions == nil || f.user.Permissions[f.user.OrgID] == nil {
		return "", "(1 = 0)", nil
	}
	dashWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeDashboardsPrefix)
	folderWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeFoldersPrefix)

	filter, params := accesscontrol.UserRolesFilter(f.user.OrgID, f.user.UserID, f.user.Teams, accesscontrol.GetOrgRoles(f.user))
	rolesFilter := " AND role_id IN(SELECT id FROM role " + filter + ") "
	var args []interface{}
	builder := strings.Builder{}
	builder.WriteRune('(')
	var recQries []string
	withClause := ""
	if len(f.dashboardActions) > 0 {
		toCheck := actionsToCheck(f.dashboardActions, f.user.Permissions[f.user.OrgID], dashWildcards, folderWildcards)

		if len(toCheck) > 0 {
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

			builder.WriteString(" OR ")
			builder.WriteString("(dashboard.folder_id IN (SELECT id FROM dashboard as d ")
			sb := strings.Builder{}
			sb.WriteString("(SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' ")
			sb.WriteString(rolesFilter)
			args = append(args, params...)

			if len(toCheck) == 1 {
				sb.WriteString(" AND action = ?")
				args = append(args, toCheck[0])
			} else {
				sb.WriteString(" AND action IN (?" + strings.Repeat(", ?", len(toCheck)-1) + ") GROUP BY role_id, scope HAVING COUNT(action) = ?")
				args = append(args, toCheck...)
				args = append(args, len(toCheck))
			}
			sb.WriteString(")")

			switch f.features.IsEnabled(featuremgmt.FlagNestedFolders) {
			case true:
				recQries = append(recQries, getFoldersWithPermissions(sb.String()))
				builder.WriteString("WHERE d.uid IN (SELECT uid FROM RecQry)")
			default:
				builder.WriteString("WHERE d.uid IN ")
				builder.WriteString(sb.String())
			}
			builder.WriteString(") AND NOT dashboard.is_folder)")
		} else {
			builder.WriteString("NOT dashboard.is_folder")
		}
	}

	if len(f.folderActions) > 0 {
		if len(f.dashboardActions) > 0 {
			builder.WriteString(" OR ")
		}

		toCheck := actionsToCheck(f.folderActions, f.user.Permissions[f.user.OrgID], folderWildcards)
		if len(toCheck) > 0 {
			builder.WriteString("(dashboard.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%'")
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
			builder.WriteString(") AND dashboard.is_folder)")
		} else {
			builder.WriteString("dashboard.is_folder")
		}
	}
	builder.WriteRune(')')

	if len(recQries) > 0 {
		withClause = fmt.Sprintf("WITH RECURSIVE %s", strings.Join(recQries, ","))
	}
	return withClause, builder.String(), args
}

func getFoldersWithPermissions(whereUIDSelect string) string {
	return fmt.Sprintf(`RecQry AS (
			SELECT uid, parent_uid, org_id FROM folder WHERE uid IN %s
			UNION ALL SELECT f.uid, f.parent_uid, f.org_id FROM folder f INNER JOIN RecQry r ON f.parent_uid = r.uid and f.org_id = r.org_id
		)`, whereUIDSelect)
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

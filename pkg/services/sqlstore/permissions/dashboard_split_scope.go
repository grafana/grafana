package permissions

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	dashWildcards   = accesscontrol.WildcardsFromPrefix(dashboards.ScopeDashboardsPrefix)
	folderWildcards = accesscontrol.WildcardsFromPrefix(dashboards.ScopeFoldersPrefix)
)

// TODO: Nested folder support with cte and without...
func NewDashboardFilter(
	usr *user.SignedInUser,
	permissionLevel dashboards.PermissionType,
	queryType string,
	features featuremgmt.FeatureToggles,
	reqQrySupported bool,
) *DashboardFilter {
	needEdit := permissionLevel > dashboards.PERMISSION_VIEW

	var folderAction string
	var dashboardAction string

	if queryType == searchstore.TypeFolder {
		folderAction = dashboards.ActionFoldersRead
		if needEdit {
			folderAction = dashboards.ActionDashboardsCreate
		}
	} else if queryType == searchstore.TypeDashboard {
		dashboardAction = dashboards.ActionDashboardsRead
		if needEdit {
			dashboardAction = dashboards.ActionDashboardsWrite
		}
	} else if queryType == searchstore.TypeAlertFolder {
		folderAction = accesscontrol.ActionAlertingRuleRead
		if needEdit {
			folderAction = accesscontrol.ActionAlertingRuleCreate
		}
	} else {
		folderAction = dashboards.ActionFoldersRead
		dashboardAction = dashboards.ActionDashboardsRead
		if needEdit {
			folderAction = dashboards.ActionDashboardsCreate
			dashboardAction = dashboards.ActionDashboardsWrite
		}
	}

	needToCheckFolderAction := needToCheckAction(folderAction, usr.Permissions[usr.OrgID], folderWildcards)
	needToCheckDashboardAction := needToCheckAction(dashboardAction, usr.Permissions[usr.OrgID], dashWildcards, folderWildcards)

	f := &DashboardFilter{
		usr: usr, features: features, reqQrySupported: reqQrySupported,
		needToCheckFolderAction: needToCheckFolderAction, needToCheckDashboardAction: needToCheckDashboardAction,
	}

	f.buildClauses(folderAction, dashboardAction)
	return f
}

type DashboardFilter struct {
	usr   *user.SignedInUser
	join  clause
	where clause

	reqQrySupported bool
	features        featuremgmt.FeatureToggles

	needToCheckFolderAction    bool
	needToCheckDashboardAction bool
}

func (f *DashboardFilter) LeftJoin() string {
	return " dashboard AS folder ON dashboard.org_id = folder.org_id AND dashboard.folder_id = folder.id " + f.join.string
}

func (f *DashboardFilter) Where() (string, []interface{}) {
	return f.where.string, f.where.params
}

func (f *DashboardFilter) buildClauses(folderAction, dashboardAction string) {
	if f.hasNoPermissions() {
		f.join = clause{string: ""}
		f.where = clause{string: "(1 = 0)"}
		return
	}

	// if user has wildcard for both folders and dashboard we can skip performing access check
	if f.hasNoActionsToCheck() {
		f.join = clause{string: ""}
		f.where = clause{string: "(1 = 1)"}
		return
	}

	useSelfContained := f.usr.AuthenticatedBy == login.ExtendedJWTModule

	query := strings.Builder{}

	if !useSelfContained {
		// build join clause
		query.WriteString("LEFT OUTER JOIN permission p ON (dashboard.uid = p.identifier OR folder.uid = p.identifier)")
		f.join = clause{string: query.String()}

		// recycle and reuse
		query.Reset()
	}

	params := []interface{}{}
	query.WriteByte('(')

	roleFilter, roleFilterParams := accesscontrol.UserRolesFilter(f.usr.OrgID, f.usr.UserID, f.usr.Teams, accesscontrol.GetOrgRoles(f.usr))

	if dashboardAction != "" {
		if f.needToCheckDashboardAction {
			if !useSelfContained {
				query.WriteString(fmt.Sprintf(`
				((
					p.action = '%s' AND
					p.kind = 'dashboards' AND
					p.attribute = 'uid' AND
					p.role_id IN(%s) AND
					NOT dashboard.is_folder
				) OR (
					p.action = '%s' AND
					p.kind = 'folders' AND
					p.attribute = 'uid' AND
					p.role_id IN(%s) AND
					NOT dashboard.is_folder
				))
				`, dashboardAction, roleFilter, dashboardAction, roleFilter))

				params = append(params, roleFilterParams...)
				params = append(params, roleFilterParams...)
			} else {
				args := getAllowedUIDs([]string{dashboardAction}, f.usr, dashboards.ScopeDashboardsPrefix)

				// Only add the IN clause if we have any dashboards to check
				if len(args) > 0 {
					query.WriteString("(dashboard.uid IN (?" + strings.Repeat(", ?", len(args)-1) + "")
					query.WriteString(") AND NOT dashboard.is_folder)")
					params = append(params, args...)
				} else {
					query.WriteString("(1 = 0)")
				}

				query.WriteString(" OR ")

				args = getAllowedUIDs([]string{dashboardAction}, f.usr, dashboards.ScopeFoldersPrefix)

				// Only add the IN clause if we have any folders to check
				if len(args) > 0 {
					query.WriteString("(folder.uid IN (?" + strings.Repeat(", ?", len(args)-1))
					query.WriteString(") AND NOT dashboard.is_folder)")
					params = append(params, args...)
				} else {
					query.WriteString("(1 = 0 AND NOT dashboard.is_folder)")
				}
			}
		} else {
			query.WriteString("NOT dashboard.is_folder")
		}
	}

	if folderAction != "" {
		if dashboardAction != "" {
			query.WriteString(" OR ")
		}

		if f.needToCheckFolderAction {
			if !useSelfContained {
				query.WriteString(fmt.Sprintf(`
				(
					p.action = '%s' AND
					p.kind = 'folders' AND
					p.attribute = 'uid' AND
					p.role_id IN(%s) AND
					dashboard.is_folder
				)
				`, folderAction, roleFilter))
				params = append(params, roleFilterParams...)
			} else {
				args := getAllowedUIDs([]string{folderAction}, f.usr, dashboards.ScopeFoldersPrefix)

				if len(args) > 0 {
					query.WriteString("(dashboard.uid IN(?" + strings.Repeat(", ?", len(args)-1))
					query.WriteString(") AND dashboard.is_folder)")
					params = append(params, args...)
				} else {
					query.WriteString("(1 = 0 AND dashboard.is_folder)")
				}
			}
		} else {
			query.WriteString("dashboard.is_folder")
		}
	}

	query.WriteByte(')')
	f.where = clause{string: query.String(), params: params}
}

func (f *DashboardFilter) hasNoPermissions() bool {
	return f.usr == nil || f.usr.Permissions == nil || f.usr.Permissions[f.usr.OrgID] == nil
}

func (f *DashboardFilter) hasNoActionsToCheck() bool {
	return !f.needToCheckDashboardAction && !f.needToCheckFolderAction
}

func needToCheckAction(action string, permissions map[string][]string, wildcards ...accesscontrol.Wildcards) bool {
	if action == "" {
		return false
	}
	var hasWildcard bool

	for _, scope := range permissions[action] {
		for _, w := range wildcards {
			if w.Contains(scope) {
				hasWildcard = true
				break
			}
		}
		if hasWildcard {
			break
		}
	}

	return !hasWildcard
}

package guardian

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

// CanViewAcl determines if a user has permission to view a dashboard's ACL
func CanViewAcl(dashboardId int64, role m.RoleType, isGrafanaAdmin bool, orgId int64, userId int64) (bool, error) {
	if role == m.ROLE_ADMIN || isGrafanaAdmin {
		return true, nil
	}

	filteredList, err := getAllowedDashboards([]int64{dashboardId}, orgId, userId)
	if err != nil {
		return false, err
	}

	if len(filteredList) > 0 && filteredList[0] == dashboardId {
		return true, nil
	}

	return false, nil
}

// CanDeleteFromAcl determines if a user has permission to delete from a dashboard's ACL
func CanDeleteFromAcl(dashboardId int64, role m.RoleType, isGrafanaAdmin bool, orgId int64, userId int64) (bool, error) {
	if role == m.ROLE_ADMIN || isGrafanaAdmin {
		return true, nil
	}

	permissions, err := getDashboardPermissions(dashboardId)
	if err != nil {
		return false, err
	}

	if len(permissions) == 0 {
		return true, nil
	}

	minimumPermission := m.PERMISSION_EDIT
	return checkPermission(minimumPermission, permissions, userId)
}

// CheckDashboardPermissions determines if a user has permission to view, edit or save a dashboard
func CheckDashboardPermissions(dashboardId int64, role m.RoleType, isGrafanaAdmin bool, userId int64) (bool, bool, bool, error) {
	if role == m.ROLE_ADMIN || isGrafanaAdmin {
		return true, true, true, nil
	}

	permissions, err := getDashboardPermissions(dashboardId)
	if err != nil {
		return false, false, false, err
	}

	if len(permissions) == 0 {
		return false, false, false, nil
	}

	minimumPermission := m.PERMISSION_VIEW
	canView, err := checkPermission(minimumPermission, permissions, userId)
	if err != nil {
		return false, false, false, err
	}

	minimumPermission = m.PERMISSION_READ_ONLY_EDIT
	canEdit, err := checkPermission(minimumPermission, permissions, userId)
	if err != nil {
		return false, false, false, err
	}

	minimumPermission = m.PERMISSION_EDIT
	canSave, err := checkPermission(minimumPermission, permissions, userId)
	if err != nil {
		return false, false, false, err
	}

	return canView, canEdit, canSave, nil
}

func checkPermission(minimumPermission m.PermissionType, permissions []*m.DashboardAclInfoDTO, userId int64) (bool, error) {
	userGroups, err := getUserGroupsByUser(userId)
	if err != nil {
		return false, err
	}

	for _, p := range permissions {
		if p.UserId == userId && p.PermissionType >= minimumPermission {
			return true, nil
		}

		for _, ug := range userGroups {
			if ug.Id == p.UserGroupId && p.PermissionType >= minimumPermission {
				return true, nil
			}
		}
	}

	return false, nil
}

func getAllowedDashboards(dashList []int64, orgId int64, userId int64) ([]int64, error) {
	query := m.GetAllowedDashboardsQuery{UserId: userId, OrgId: orgId, DashList: dashList}
	err := bus.Dispatch(&query)

	return query.Result, err
}

func getDashboardPermissions(dashboardId int64) ([]*m.DashboardAclInfoDTO, error) {
	query := m.GetDashboardPermissionsQuery{DashboardId: dashboardId}
	err := bus.Dispatch(&query)

	return query.Result, err
}

func getUserGroupsByUser(userId int64) ([]*m.UserGroup, error) {
	query := m.GetUserGroupsByUserQuery{UserId: userId}
	err := bus.Dispatch(&query)

	return query.Result, err
}

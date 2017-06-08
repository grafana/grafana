package guardian

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

// RemoveRestrictedDashboards filters out dashboards from the list that the user does have access to
func RemoveRestrictedDashboards(dashList []int64, orgId int64, userId int64) ([]int64, error) {
	user, err := getUser(userId)
	if err != nil {
		return nil, err
	}

	if user.IsGrafanaAdmin || user.OrgRole == m.ROLE_ADMIN {
		return dashList, nil
	}

	filteredList, err := getAllowedDashboards(dashList, orgId, userId)

	return filteredList, err
}

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

	userGroups, err := getUserGroupsByUser(userId)

	for _, p := range permissions {
		if p.UserId == userId && p.PermissionType == m.PERMISSION_EDIT {
			return true, nil
		}

		for _, ug := range userGroups {
			if ug.Id == p.UserGroupId && p.PermissionType == m.PERMISSION_EDIT {
				return true, nil
			}
		}
	}

	return false, nil
}

func getUser(userId int64) (*m.SignedInUser, error) {
	query := m.GetSignedInUserQuery{UserId: userId}
	err := bus.Dispatch(&query)

	return query.Result, err
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

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

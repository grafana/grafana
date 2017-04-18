package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

// GET /api/user-groups/:userGroupId/members
func GetUserGroupMembers(c *middleware.Context) Response {
	query := m.GetUserGroupMembersQuery{UserGroupId: c.ParamsInt64(":userGroupId")}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to get User Group Members", err)
	}

	return Json(200, query.Result)
}

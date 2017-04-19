package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// GET /api/user-groups/:userGroupId/members
func GetUserGroupMembers(c *middleware.Context) Response {
	query := m.GetUserGroupMembersQuery{UserGroupId: c.ParamsInt64(":userGroupId")}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to get User Group Members", err)
	}

	return Json(200, query.Result)
}

// POST /api/user-groups/:userGroupId/members
func AddUserGroupMember(c *middleware.Context, cmd m.AddUserGroupMemberCommand) Response {
	cmd.UserGroupId = c.ParamsInt64(":userGroupId")
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrUserGroupMemberAlreadyAdded {
			return ApiError(400, "User is already added to this user group", err)
		}
		return ApiError(500, "Failed to add Member to User Group", err)
	}

	return Json(200, &util.DynMap{
		"message": "Member added to User Group",
	})
}

// DELETE /api/user-groups/:userGroupId/members/:userId
func RemoveUserGroupMember(c *middleware.Context) Response {
	if err := bus.Dispatch(&m.RemoveUserGroupMemberCommand{UserGroupId: c.ParamsInt64(":userGroupId"), UserId: c.ParamsInt64(":userId")}); err != nil {
		return ApiError(500, "Failed to remove Member from User Group", err)
	}
	return ApiSuccess("User Group Member removed")
}

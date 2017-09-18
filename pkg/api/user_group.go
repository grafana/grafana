package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// POST /api/user-groups
func CreateUserGroup(c *middleware.Context, cmd m.CreateUserGroupCommand) Response {
	cmd.OrgId = c.OrgId
	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrUserGroupNameTaken {
			return ApiError(409, "User Group name taken", err)
		}
		return ApiError(500, "Failed to create User Group", err)
	}

	return Json(200, &util.DynMap{
		"userGroupId": cmd.Result.Id,
		"message":     "User Group created",
	})
}

// PUT /api/user-groups/:userGroupId
func UpdateUserGroup(c *middleware.Context, cmd m.UpdateUserGroupCommand) Response {
	cmd.Id = c.ParamsInt64(":userGroupId")
	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrUserGroupNameTaken {
			return ApiError(400, "User Group name taken", err)
		}
		return ApiError(500, "Failed to update User Group", err)
	}

	return ApiSuccess("User Group updated")
}

// DELETE /api/user-groups/:userGroupId
func DeleteUserGroupById(c *middleware.Context) Response {
	if err := bus.Dispatch(&m.DeleteUserGroupCommand{Id: c.ParamsInt64(":userGroupId")}); err != nil {
		if err == m.ErrUserGroupNotFound {
			return ApiError(404, "Failed to delete User Group. ID not found", nil)
		}
		return ApiError(500, "Failed to update User Group", err)
	}
	return ApiSuccess("User Group deleted")
}

// GET /api/user-groups/search
func SearchUserGroups(c *middleware.Context) Response {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")
	if page < 1 {
		page = 1
	}

	query := m.SearchUserGroupsQuery{
		Query: c.Query("query"),
		Name:  c.Query("name"),
		Page:  page,
		Limit: perPage,
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to search User Groups", err)
	}

	query.Result.Page = page
	query.Result.PerPage = perPage

	return Json(200, query.Result)
}

// GET /api/user-groups/:userGroupId
func GetUserGroupById(c *middleware.Context) Response {
	query := m.GetUserGroupByIdQuery{Id: c.ParamsInt64(":userGroupId")}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrUserGroupNotFound {
			return ApiError(404, "User Group not found", err)
		}

		return ApiError(500, "Failed to get User Group", err)
	}

	return Json(200, &query.Result)
}

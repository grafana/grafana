package api

import (
	"github.com/Cepave/grafana/pkg/bus"
	"github.com/Cepave/grafana/pkg/middleware"
	m "github.com/Cepave/grafana/pkg/models"
)

// POST /api/org/users
func AddOrgUserToCurrentOrg(c *middleware.Context, cmd m.AddOrgUserCommand) Response {
	cmd.OrgId = c.OrgId
	return addOrgUserHelper(cmd)
}

// POST /api/orgs/:orgId/users
func AddOrgUser(c *middleware.Context, cmd m.AddOrgUserCommand) Response {
	cmd.OrgId = c.ParamsInt64(":orgId")
	return addOrgUserHelper(cmd)
}

func addOrgUserHelper(cmd m.AddOrgUserCommand) Response {
	if !cmd.Role.IsValid() {
		return ApiError(400, "Invalid role specified", nil)
	}

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: cmd.LoginOrEmail}
	err := bus.Dispatch(&userQuery)
	if err != nil {
		return ApiError(404, "User not found", nil)
	}

	userToAdd := userQuery.Result

	// if userToAdd.Id == c.UserId {
	// 	return ApiError(400, "Cannot add yourself as user", nil)
	// }

	cmd.UserId = userToAdd.Id

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Could not add user to organization", err)
	}

	return ApiSuccess("User added to organization")
}

// GET /api/org/users
func GetOrgUsersForCurrentOrg(c *middleware.Context) Response {
	return getOrgUsersHelper(c.OrgId)
}

// GET /api/orgs/:orgId/users
func GetOrgUsers(c *middleware.Context) Response {
	return getOrgUsersHelper(c.ParamsInt64(":orgId"))
}

func getOrgUsersHelper(orgId int64) Response {
	query := m.GetOrgUsersQuery{OrgId: orgId}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to get account user", err)
	}

	return Json(200, query.Result)
}

// PATCH /api/org/users/:userId
func UpdateOrgUserForCurrentOrg(c *middleware.Context, cmd m.UpdateOrgUserCommand) Response {
	cmd.OrgId = c.OrgId
	cmd.UserId = c.ParamsInt64(":userId")
	return updateOrgUserHelper(cmd)
}

// PATCH /api/orgs/:orgId/users/:userId
func UpdateOrgUser(c *middleware.Context, cmd m.UpdateOrgUserCommand) Response {
	cmd.OrgId = c.ParamsInt64(":orgId")
	cmd.UserId = c.ParamsInt64(":userId")
	return updateOrgUserHelper(cmd)
}

func updateOrgUserHelper(cmd m.UpdateOrgUserCommand) Response {
	if !cmd.Role.IsValid() {
		return ApiError(400, "Invalid role specified", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrLastOrgAdmin {
			return ApiError(400, "Cannot change role so that there is no organization admin left", nil)
		}
		return ApiError(500, "Failed update org user", err)
	}

	return ApiSuccess("Organization user updated")
}

// DELETE /api/org/users/:userId
func RemoveOrgUserForCurrentOrg(c *middleware.Context) Response {
	userId := c.ParamsInt64(":userId")
	return removeOrgUserHelper(c.OrgId, userId)
}

// DELETE /api/orgs/:orgId/users/:userId
func RemoveOrgUser(c *middleware.Context) Response {
	userId := c.ParamsInt64(":userId")
	orgId := c.ParamsInt64(":orgId")
	return removeOrgUserHelper(orgId, userId)
}

func removeOrgUserHelper(orgId int64, userId int64) Response {
	cmd := m.RemoveOrgUserCommand{OrgId: orgId, UserId: userId}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrLastOrgAdmin {
			return ApiError(400, "Cannot remove last organization admin", nil)
		}
		return ApiError(500, "Failed to remove user from organization", err)
	}

	return ApiSuccess("User removed from organization")
}

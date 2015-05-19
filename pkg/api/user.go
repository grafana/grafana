package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// GET /api/user  (current authenticated user)
func GetSignedInUser(c *middleware.Context) Response {
	return getUserUserProfile(c.UserId)
}

// GET /api/user/:id
func GetUserById(c *middleware.Context) Response {
	return getUserUserProfile(c.ParamsInt64(":id"))
}

func getUserUserProfile(userId int64) Response {
	query := m.GetUserProfileQuery{UserId: userId}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to get user", err)
	}

	return Json(200, query.Result)
}

// POST /api/user
func UpdateSignedInUser(c *middleware.Context, cmd m.UpdateUserCommand) Response {
	cmd.UserId = c.UserId
	return handleUpdateUser(cmd)
}

// POST /api/users/:id
func UpdateUser(c *middleware.Context, cmd m.UpdateUserCommand) Response {
	cmd.UserId = c.ParamsInt64(":id")
	return handleUpdateUser(cmd)
}

func handleUpdateUser(cmd m.UpdateUserCommand) Response {
	if len(cmd.Login) == 0 {
		cmd.Login = cmd.Email
		if len(cmd.Login) == 0 {
			return ApiError(400, "Validation error, need specify either username or email", nil)
		}
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "failed to update user", err)
	}

	return ApiSuccess("User updated")
}

// GET /api/user/orgs
func GetSignedInUserOrgList(c *middleware.Context) Response {
	return getUserOrgList(c.UserId)
}

// GET /api/user/:id/orgs
func GetUserOrgList(c *middleware.Context) Response {
	return getUserOrgList(c.ParamsInt64(":id"))
}

func getUserOrgList(userId int64) Response {
	query := m.GetUserOrgListQuery{UserId: userId}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Faile to get user organziations", err)
	}

	return Json(200, query.Result)
}

func validateUsingOrg(userId int64, orgId int64) bool {
	query := m.GetUserOrgListQuery{UserId: userId}

	if err := bus.Dispatch(&query); err != nil {
		return false
	}

	// validate that the org id in the list
	valid := false
	for _, other := range query.Result {
		if other.OrgId == orgId {
			valid = true
		}
	}

	return valid
}

func UserSetUsingOrg(c *middleware.Context) {
	orgId := c.ParamsInt64(":id")

	if !validateUsingOrg(c.UserId, orgId) {
		c.JsonApiErr(401, "Not a valid organization", nil)
		return
	}

	cmd := m.SetUsingOrgCommand{
		UserId: c.UserId,
		OrgId:  orgId,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed change active organization", err)
		return
	}

	c.JsonOK("Active organization changed")
}

func ChangeUserPassword(c *middleware.Context, cmd m.ChangeUserPasswordCommand) {
	userQuery := m.GetUserByIdQuery{Id: c.UserId}

	if err := bus.Dispatch(&userQuery); err != nil {
		c.JsonApiErr(500, "Could not read user from database", err)
		return
	}

	passwordHashed := util.EncodePassword(cmd.OldPassword, userQuery.Result.Salt)
	if passwordHashed != userQuery.Result.Password {
		c.JsonApiErr(401, "Invalid old password", nil)
		return
	}

	if len(cmd.NewPassword) < 4 {
		c.JsonApiErr(400, "New password too short", nil)
		return
	}

	cmd.UserId = c.UserId
	cmd.NewPassword = util.EncodePassword(cmd.NewPassword, userQuery.Result.Salt)

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to change user password", err)
		return
	}

	c.JsonOK("User password changed")
}

// GET /api/users
func SearchUsers(c *middleware.Context) Response {
	query := m.SearchUsersQuery{Query: "", Page: 0, Limit: 1000}
	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to fetch users", err)
	}

	return Json(200, query.Result)
}

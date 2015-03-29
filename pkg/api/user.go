package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func GetUser(c *middleware.Context) {
	query := m.GetUserProfileQuery{UserId: c.UserId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to get user", err)
		return
	}

	c.JSON(200, query.Result)
}

func UpdateUser(c *middleware.Context, cmd m.UpdateUserCommand) {
	cmd.UserId = c.UserId

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(400, "Failed to update user", err)
		return
	}

	c.JsonOK("User updated")
}

func GetUserOrgList(c *middleware.Context) {
	query := m.GetUserOrgListQuery{UserId: c.UserId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to get user organizations", err)
		return
	}

	for _, ac := range query.Result {
		if ac.OrgId == c.OrgId {
			ac.IsUsing = true
			break
		}
	}

	c.JSON(200, query.Result)
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

package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func AddOrgUser(c *middleware.Context, cmd m.AddOrgUserCommand) {
	if !cmd.Role.IsValid() {
		c.JsonApiErr(400, "Invalid role specified", nil)
		return
	}

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: cmd.LoginOrEmail}
	err := bus.Dispatch(&userQuery)
	if err != nil {
		c.JsonApiErr(404, "User not found", nil)
		return
	}

	userToAdd := userQuery.Result

	if userToAdd.Id == c.UserId {
		c.JsonApiErr(400, "Cannot add yourself as user", nil)
		return
	}

	cmd.OrgId = c.OrgId
	cmd.UserId = userToAdd.Id

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Could not add user to organization", err)
		return
	}

	c.JsonOK("User added to organization")
}

func GetOrgUsers(c *middleware.Context) {
	query := m.GetOrgUsersQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to get account user", err)
		return
	}

	c.JSON(200, query.Result)
}

func UpdateOrgUser(c *middleware.Context, cmd m.UpdateOrgUserCommand) {
	if !cmd.Role.IsValid() {
		c.JsonApiErr(400, "Invalid role specified", nil)
		return
	}

	cmd.UserId = c.ParamsInt64(":id")
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed update org user", err)
		return
	}

	c.JsonOK("Organization user updated")
}

func RemoveOrgUser(c *middleware.Context) {
	userId := c.ParamsInt64(":id")

	cmd := m.RemoveOrgUserCommand{OrgId: c.OrgId, UserId: userId}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrLastOrgAdmin {
			c.JsonApiErr(400, "Cannot remove last organization admin", nil)
			return
		}
		c.JsonApiErr(500, "Failed to remove user from organization", err)
	}

	c.JsonOK("User removed from organization")
}

package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

// POST /api/org/users
func AddOrgUserToCurrentOrg(c *m.ReqContext, cmd m.AddOrgUserCommand) Response {
	cmd.OrgId = c.OrgId
	return addOrgUserHelper(cmd)
}

// POST /api/orgs/:orgId/users
func AddOrgUser(c *m.ReqContext, cmd m.AddOrgUserCommand) Response {
	cmd.OrgId = c.ParamsInt64(":orgId")
	return addOrgUserHelper(cmd)
}

func addOrgUserHelper(cmd m.AddOrgUserCommand) Response {
	if !cmd.Role.IsValid() {
		return Error(400, "Invalid role specified", nil)
	}

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: cmd.LoginOrEmail}
	err := bus.Dispatch(&userQuery)
	if err != nil {
		return Error(404, "User not found", nil)
	}

	userToAdd := userQuery.Result

	cmd.UserId = userToAdd.Id

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrOrgUserAlreadyAdded {
			return Error(409, "User is already member of this organization", nil)
		}
		return Error(500, "Could not add user to organization", err)
	}

	return Success("User added to organization")
}

// GET /api/org/users
func GetOrgUsersForCurrentOrg(c *m.ReqContext) Response {
	return getOrgUsersHelper(c.OrgId, c.Params("query"), c.ParamsInt("limit"))
}

// GET /api/orgs/:orgId/users
func GetOrgUsers(c *m.ReqContext) Response {
	return getOrgUsersHelper(c.ParamsInt64(":orgId"), "", 0)
}

func getOrgUsersHelper(orgID int64, query string, limit int) Response {
	q := m.GetOrgUsersQuery{
		OrgId: orgID,
		Query: query,
		Limit: limit,
	}

	if err := bus.Dispatch(&q); err != nil {
		return Error(500, "Failed to get account user", err)
	}

	for _, user := range q.Result {
		user.AvatarUrl = dtos.GetGravatarUrl(user.Email)
	}

	return JSON(200, q.Result)
}

// PATCH /api/org/users/:userId
func UpdateOrgUserForCurrentOrg(c *m.ReqContext, cmd m.UpdateOrgUserCommand) Response {
	cmd.OrgId = c.OrgId
	cmd.UserId = c.ParamsInt64(":userId")
	return updateOrgUserHelper(cmd)
}

// PATCH /api/orgs/:orgId/users/:userId
func UpdateOrgUser(c *m.ReqContext, cmd m.UpdateOrgUserCommand) Response {
	cmd.OrgId = c.ParamsInt64(":orgId")
	cmd.UserId = c.ParamsInt64(":userId")
	return updateOrgUserHelper(cmd)
}

func updateOrgUserHelper(cmd m.UpdateOrgUserCommand) Response {
	if !cmd.Role.IsValid() {
		return Error(400, "Invalid role specified", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrLastOrgAdmin {
			return Error(400, "Cannot change role so that there is no organization admin left", nil)
		}
		return Error(500, "Failed update org user", err)
	}

	return Success("Organization user updated")
}

// DELETE /api/org/users/:userId
func RemoveOrgUserForCurrentOrg(c *m.ReqContext) Response {
	userID := c.ParamsInt64(":userId")
	return removeOrgUserHelper(c.OrgId, userID)
}

// DELETE /api/orgs/:orgId/users/:userId
func RemoveOrgUser(c *m.ReqContext) Response {
	userID := c.ParamsInt64(":userId")
	orgID := c.ParamsInt64(":orgId")
	return removeOrgUserHelper(orgID, userID)
}

func removeOrgUserHelper(orgID int64, userID int64) Response {
	cmd := m.RemoveOrgUserCommand{OrgId: orgID, UserId: userID}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrLastOrgAdmin {
			return Error(400, "Cannot remove last organization admin", nil)
		}
		return Error(500, "Failed to remove user from organization", err)
	}

	return Success("User removed from organization")
}

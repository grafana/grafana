package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// POST /api/org/users
func AddOrgUserToCurrentOrg(c *models.ReqContext, cmd models.AddOrgUserCommand) Response {
	cmd.OrgId = c.OrgId
	return addOrgUserHelper(cmd)
}

// POST /api/orgs/:orgId/users
func AddOrgUser(c *models.ReqContext, cmd models.AddOrgUserCommand) Response {
	cmd.OrgId = c.ParamsInt64(":orgId")
	return addOrgUserHelper(cmd)
}

func addOrgUserHelper(cmd models.AddOrgUserCommand) Response {
	if !cmd.Role.IsValid() {
		return Error(400, "Invalid role specified", nil)
	}

	userQuery := models.GetUserByLoginQuery{LoginOrEmail: cmd.LoginOrEmail}
	err := bus.Dispatch(&userQuery)
	if err != nil {
		return Error(404, "User not found", nil)
	}

	userToAdd := userQuery.Result

	cmd.UserId = userToAdd.Id

	if err := bus.Dispatch(&cmd); err != nil {
		if err == models.ErrOrgUserAlreadyAdded {
			return JSON(409, util.DynMap{
				"message": "User is already member of this organization",
				"userId":  cmd.UserId,
			})
		}
		return Error(500, "Could not add user to organization", err)
	}

	return JSON(200, util.DynMap{
		"message": "User added to organization",
		"userId":  cmd.UserId,
	})
}

// GET /api/org/users
func GetOrgUsersForCurrentOrg(c *models.ReqContext) Response {
	result, err := getOrgUsersHelper(c.OrgId, c.Query("query"), c.QueryInt("limit"))
	if err != nil {
		return Error(500, "Failed to get users for current organization", err)
	}

	return JSON(200, result)
}

// GET /api/org/users/lookup
func GetOrgUsersForCurrentOrgLookup(c *models.ReqContext) Response {
	isAdmin, err := isOrgAdminFolderAdminOrTeamAdmin(c)
	if err != nil {
		return Error(500, "Failed to get users for current organization", err)
	}

	if !isAdmin {
		return Error(403, "Permission denied", nil)
	}

	orgUsers, err := getOrgUsersHelper(c.OrgId, c.Query("query"), c.QueryInt("limit"))
	if err != nil {
		return Error(500, "Failed to get users for current organization", err)
	}

	result := make([]*dtos.UserLookupDTO, 0)

	for _, u := range orgUsers {
		result = append(result, &dtos.UserLookupDTO{
			UserID:    u.UserId,
			Login:     u.Login,
			AvatarURL: u.AvatarUrl,
		})
	}

	return JSON(200, result)
}

func isOrgAdminFolderAdminOrTeamAdmin(c *models.ReqContext) (bool, error) {
	if c.OrgRole == models.ROLE_ADMIN {
		return true, nil
	}

	hasAdminPermissionInFoldersQuery := models.HasAdminPermissionInFoldersQuery{SignedInUser: c.SignedInUser}
	if err := bus.Dispatch(&hasAdminPermissionInFoldersQuery); err != nil {
		return false, err
	}

	if hasAdminPermissionInFoldersQuery.Result {
		return true, nil
	}

	isAdminOfTeamsQuery := models.IsAdminOfTeamsQuery{SignedInUser: c.SignedInUser}
	if err := bus.Dispatch(&isAdminOfTeamsQuery); err != nil {
		return false, err
	}

	return isAdminOfTeamsQuery.Result, nil
}

// GET /api/orgs/:orgId/users
func GetOrgUsers(c *models.ReqContext) Response {
	result, err := getOrgUsersHelper(c.ParamsInt64(":orgId"), "", 0)
	if err != nil {
		return Error(500, "Failed to get users for organization", err)
	}

	return JSON(200, result)
}

func getOrgUsersHelper(orgID int64, query string, limit int) ([]*models.OrgUserDTO, error) {
	q := models.GetOrgUsersQuery{
		OrgId: orgID,
		Query: query,
		Limit: limit,
	}

	if err := bus.Dispatch(&q); err != nil {
		return nil, err
	}

	for _, user := range q.Result {
		user.AvatarUrl = dtos.GetGravatarUrl(user.Email)
	}

	return q.Result, nil
}

// PATCH /api/org/users/:userId
func UpdateOrgUserForCurrentOrg(c *models.ReqContext, cmd models.UpdateOrgUserCommand) Response {
	cmd.OrgId = c.OrgId
	cmd.UserId = c.ParamsInt64(":userId")
	return updateOrgUserHelper(cmd)
}

// PATCH /api/orgs/:orgId/users/:userId
func UpdateOrgUser(c *models.ReqContext, cmd models.UpdateOrgUserCommand) Response {
	cmd.OrgId = c.ParamsInt64(":orgId")
	cmd.UserId = c.ParamsInt64(":userId")
	return updateOrgUserHelper(cmd)
}

func updateOrgUserHelper(cmd models.UpdateOrgUserCommand) Response {
	if !cmd.Role.IsValid() {
		return Error(400, "Invalid role specified", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == models.ErrLastOrgAdmin {
			return Error(400, "Cannot change role so that there is no organization admin left", nil)
		}
		return Error(500, "Failed update org user", err)
	}

	return Success("Organization user updated")
}

// DELETE /api/org/users/:userId
func RemoveOrgUserForCurrentOrg(c *models.ReqContext) Response {
	return removeOrgUserHelper(&models.RemoveOrgUserCommand{
		UserId:                   c.ParamsInt64(":userId"),
		OrgId:                    c.OrgId,
		ShouldDeleteOrphanedUser: true,
	})
}

// DELETE /api/orgs/:orgId/users/:userId
func RemoveOrgUser(c *models.ReqContext) Response {
	return removeOrgUserHelper(&models.RemoveOrgUserCommand{
		UserId: c.ParamsInt64(":userId"),
		OrgId:  c.ParamsInt64(":orgId"),
	})
}

func removeOrgUserHelper(cmd *models.RemoveOrgUserCommand) Response {
	if err := bus.Dispatch(cmd); err != nil {
		if err == models.ErrLastOrgAdmin {
			return Error(400, "Cannot remove last organization admin", nil)
		}
		return Error(500, "Failed to remove user from organization", err)
	}

	if cmd.UserWasDeleted {
		return Success("User deleted")
	}

	return Success("User removed from organization")
}

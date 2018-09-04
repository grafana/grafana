package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// check member is team admin or grafanaadmin
func checkTeamPermisstion(c *m.ReqContext) bool {
	if c.IsGrafanaAdmin {
		return true
	} else {
		query := m.GetTeamMembersQuery{OrgId: c.OrgId, TeamId: c.ParamsInt64(":teamId"), UserId: c.UserId}
		if err := bus.Dispatch(&query); err != nil {
			return false
		}
		isTeamAdmin := false
		for _, member := range query.Result {
			if member.IsTeamAdmin {
				isTeamAdmin = true
			}
		}
		return isTeamAdmin
	}
}

// GET /api/teams/:teamId/members
func GetTeamMembers(c *m.ReqContext) Response {
	if checkTeamPermisstion(c) == false {
		return Error(400, "You are not a team admin or grafana admin", nil)
	}

	query := m.GetTeamMembersQuery{OrgId: c.OrgId, TeamId: c.ParamsInt64(":teamId")}

	if err := bus.Dispatch(&query); err != nil {
		return Error(500, "Failed to get Team Members", err)
	}

	for _, member := range query.Result {
		member.AvatarUrl = dtos.GetGravatarUrl(member.Email)
	}

	return JSON(200, query.Result)
}

// POST /api/teams/:teamId/members
func AddTeamMember(c *m.ReqContext, cmd m.AddTeamMemberCommand) Response {
	if checkTeamPermisstion(c) == false {
		return Error(400, "You are not a team admin or grafana admin", nil)
	}

	cmd.TeamId = c.ParamsInt64(":teamId")
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrTeamNotFound {
			return Error(404, "Team not found", nil)
		}

		if err == m.ErrTeamMemberAlreadyAdded {
			return Error(400, "User is already added to this team", nil)
		}

		return Error(500, "Failed to add Member to Team", err)
	}

	return JSON(200, &util.DynMap{
		"message": "Member added to Team",
	})
}

// DELETE /api/teams/:teamId/members/:userId
func RemoveTeamMember(c *m.ReqContext) Response {
	if checkTeamPermisstion(c) == false {
		return Error(400, "You are not a team admin or grafana admin", nil)
	}

	if err := bus.Dispatch(&m.RemoveTeamMemberCommand{OrgId: c.OrgId, TeamId: c.ParamsInt64(":teamId"), UserId: c.ParamsInt64(":userId")}); err != nil {
		if err == m.ErrTeamNotFound {
			return Error(404, "Team not found", nil)
		}

		if err == m.ErrTeamMemberNotFound {
			return Error(404, "Team member not found", nil)
		}

		return Error(500, "Failed to remove Member from Team", err)
	}
	return Success("Team Member removed")
}

// Put /api/teams/:teamId/members/:userId
func UpdateIsTeamAdmin(c *m.ReqContext, cmd m.UpdateIsTeamAdminCommand) Response {
	if checkTeamPermisstion(c) == false {
		return Error(400, "You are not a team admin or grafana admin", nil)
	}

	cmd.OrgId = c.OrgId
	cmd.TeamId = c.ParamsInt64(":teamId")
	cmd.UserId = c.ParamsInt64(":userId")
	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrTeamNotFound {
			return Error(404, "Team not found", nil)
		}

		if err == m.ErrTeamMemberNotFound {
			return Error(404, "Team member not found", nil)
		}

		return Error(500, "Failed to update isTeamAdmin", err)
	}
	return Success("update isTeamAdmin success")
}

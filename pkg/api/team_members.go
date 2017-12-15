package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// GET /api/teams/:teamId/members
func GetTeamMembers(c *middleware.Context) Response {
	query := m.GetTeamMembersQuery{TeamId: c.ParamsInt64(":teamId")}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to get Team Members", err)
	}

	return Json(200, query.Result)
}

// POST /api/teams/:teamId/members
func AddTeamMember(c *middleware.Context, cmd m.AddTeamMemberCommand) Response {
	cmd.TeamId = c.ParamsInt64(":teamId")
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrTeamMemberAlreadyAdded {
			return ApiError(400, "User is already added to this team", err)
		}
		return ApiError(500, "Failed to add Member to Team", err)
	}

	return Json(200, &util.DynMap{
		"message": "Member added to Team",
	})
}

// DELETE /api/teams/:teamId/members/:userId
func RemoveTeamMember(c *middleware.Context) Response {
	if err := bus.Dispatch(&m.RemoveTeamMemberCommand{TeamId: c.ParamsInt64(":teamId"), UserId: c.ParamsInt64(":userId")}); err != nil {
		return ApiError(500, "Failed to remove Member from Team", err)
	}
	return ApiSuccess("Team Member removed")
}

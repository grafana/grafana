package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// POST /api/teams
func CreateTeam(c *middleware.Context, cmd m.CreateTeamCommand) Response {
	cmd.OrgId = c.OrgId
	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrTeamNameTaken {
			return ApiError(409, "Team name taken", err)
		}
		return ApiError(500, "Failed to create Team", err)
	}

	return Json(200, &util.DynMap{
		"teamId":  cmd.Result.Id,
		"message": "Team created",
	})
}

// PUT /api/teams/:teamId
func UpdateTeam(c *middleware.Context, cmd m.UpdateTeamCommand) Response {
	cmd.Id = c.ParamsInt64(":teamId")
	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrTeamNameTaken {
			return ApiError(400, "Team name taken", err)
		}
		return ApiError(500, "Failed to update Team", err)
	}

	return ApiSuccess("Team updated")
}

// DELETE /api/teams/:teamId
func DeleteTeamById(c *middleware.Context) Response {
	if err := bus.Dispatch(&m.DeleteTeamCommand{Id: c.ParamsInt64(":teamId")}); err != nil {
		if err == m.ErrTeamNotFound {
			return ApiError(404, "Failed to delete Team. ID not found", nil)
		}
		return ApiError(500, "Failed to update Team", err)
	}
	return ApiSuccess("Team deleted")
}

// GET /api/teams/search
func SearchTeams(c *middleware.Context) Response {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")
	if page < 1 {
		page = 1
	}

	query := m.SearchTeamsQuery{
		Query: c.Query("query"),
		Name:  c.Query("name"),
		Page:  page,
		Limit: perPage,
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to search Teams", err)
	}

	for _, team := range query.Result.Teams {
		team.AvatarUrl = dtos.GetGravatarUrlWithDefault(team.Email, team.Name)
	}

	query.Result.Page = page
	query.Result.PerPage = perPage

	return Json(200, query.Result)
}

// GET /api/teams/:teamId
func GetTeamById(c *middleware.Context) Response {
	query := m.GetTeamByIdQuery{Id: c.ParamsInt64(":teamId")}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrTeamNotFound {
			return ApiError(404, "Team not found", err)
		}

		return ApiError(500, "Failed to get Team", err)
	}

	return Json(200, &query.Result)
}

package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// POST /api/teams
func CreateTeam(c *m.ReqContext, cmd m.CreateTeamCommand) Response {
	cmd.OrgId = c.OrgId
	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrTeamNameTaken {
			return Error(409, "Team name taken", err)
		}
		return Error(500, "Failed to create Team", err)
	}

	return JSON(200, &util.DynMap{
		"teamId":  cmd.Result.Id,
		"message": "Team created",
	})
}

// PUT /api/teams/:teamId
func UpdateTeam(c *m.ReqContext, cmd m.UpdateTeamCommand) Response {
	cmd.OrgId = c.OrgId
	cmd.Id = c.ParamsInt64(":teamId")
	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrTeamNameTaken {
			return Error(400, "Team name taken", err)
		}
		return Error(500, "Failed to update Team", err)
	}

	return Success("Team updated")
}

// DELETE /api/teams/:teamId
func DeleteTeamByID(c *m.ReqContext) Response {
	if err := bus.Dispatch(&m.DeleteTeamCommand{OrgId: c.OrgId, Id: c.ParamsInt64(":teamId")}); err != nil {
		if err == m.ErrTeamNotFound {
			return Error(404, "Failed to delete Team. ID not found", nil)
		}
		return Error(500, "Failed to update Team", err)
	}
	return Success("Team deleted")
}

// GET /api/teams/search
func SearchTeams(c *m.ReqContext) Response {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")
	if page < 1 {
		page = 1
	}

	query := m.SearchTeamsQuery{
		OrgId: c.OrgId,
		Query: c.Query("query"),
		Name:  c.Query("name"),
		Page:  page,
		Limit: perPage,
	}

	if err := bus.Dispatch(&query); err != nil {
		return Error(500, "Failed to search Teams", err)
	}

	for _, team := range query.Result.Teams {
		team.AvatarUrl = dtos.GetGravatarUrlWithDefault(team.Email, team.Name)
	}

	query.Result.Page = page
	query.Result.PerPage = perPage

	return JSON(200, query.Result)
}

// GET /api/teams/:teamId
func GetTeamByID(c *m.ReqContext) Response {
	query := m.GetTeamByIdQuery{OrgId: c.OrgId, Id: c.ParamsInt64(":teamId")}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrTeamNotFound {
			return Error(404, "Team not found", err)
		}

		return Error(500, "Failed to get Team", err)
	}

	query.Result.AvatarUrl = dtos.GetGravatarUrlWithDefault(query.Result.Email, query.Result.Name)
	return JSON(200, &query.Result)
}

// GET /api/teams/:teamId/preferences
func GetTeamPreferences(c *m.ReqContext) Response {
	return getPreferencesFor(c.OrgId, 0, c.ParamsInt64(":teamId"))
}

// PUT /api/teams/:teamId/preferences
func UpdateTeamPreferences(c *m.ReqContext, dtoCmd dtos.UpdatePrefsCmd) Response {
	return updatePreferencesFor(c.OrgId, 0, c.ParamsInt64(":teamId"), &dtoCmd)
}

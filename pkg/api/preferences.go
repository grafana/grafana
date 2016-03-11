package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

// PUT /api/user/prefs
func SavePreferences(c *middleware.Context, cmd m.SavePreferencesCommand) Response {

	cmd.UserId = c.UserId
  cmd.OrgId  = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to saved preferences", err)
	}

	return ApiSuccess("Preferences saved")

}

// GET /api/user/prefs
func GetPreferences(c *middleware.Context) {

	query := m.GetPreferencesQuery{UserId: c.UserId, OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to get preferences", err)
	}

	dto := m.PreferencesDTO{
		Id:         query.Result.Id,
		UserId:     query.Result.UserId,
    OrgId:      query.Result.OrgId,
		Preference: query.Result.Preference,
	}

	c.JSON(200, dto)
}

package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

// PUT /api/user/prefs
func SaveUserPreferences(c *middleware.Context, cmd m.SavePreferencesCommand) Response {

	cmd.PrefId = c.UserId
	cmd.PrefType = `user`

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to saved user preferences", err)
	}

	return ApiSuccess("User preferences saved")

}

// GET /api/user/prefs
func GetUserPreferences(c *middleware.Context) {

	query := m.GetPreferencesQuery{PrefId: c.UserId, PrefType: `user`}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to get preferences for user", err)
	}

	dto := m.PreferencesDTO{
		PrefId:   query.Result.PrefId,
		PrefType: query.Result.PrefType,
		PrefData: query.Result.PrefData,
	}

	c.JSON(200, dto)
}

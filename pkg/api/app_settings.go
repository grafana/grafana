package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

func GetOrgAppsList(c *middleware.Context) Response {
	orgApps, err := plugins.GetOrgAppSettings(c.OrgId)

	if err != nil {
		return ApiError(500, "Failed to list of apps", err)
	}

	result := make([]*dtos.AppSettings, 0)
	for _, app := range plugins.Apps {
		orgApp := orgApps[app.Id]
		result = append(result, dtos.NewAppSettingsDto(app, orgApp))
	}

	return Json(200, result)
}

func GetAppSettingsById(c *middleware.Context) Response {
	appId := c.Params(":appId")

	if pluginDef, exists := plugins.Apps[appId]; !exists {
		return ApiError(404, "PluginId not found, no installed plugin with that id", nil)
	} else {
		orgApps, err := plugins.GetOrgAppSettings(c.OrgId)
		if err != nil {
			return ApiError(500, "Failed to get org app settings ", nil)
		}
		orgApp := orgApps[appId]

		return Json(200, dtos.NewAppSettingsDto(pluginDef, orgApp))
	}
}

func UpdateAppSettings(c *middleware.Context, cmd m.UpdateAppSettingsCmd) Response {
	appId := c.Params(":appId")

	cmd.OrgId = c.OrgId
	cmd.AppId = appId

	if _, ok := plugins.Apps[cmd.AppId]; !ok {
		return ApiError(404, "App type not installed.", nil)
	}

	err := bus.Dispatch(&cmd)
	if err != nil {
		return ApiError(500, "Failed to update App Plugin", err)
	}

	return ApiSuccess("App updated")
}

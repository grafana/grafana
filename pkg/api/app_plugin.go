package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

func GetAppPlugins(c *middleware.Context) Response {
	query := m.GetAppPluginsQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to list Plugin Bundles", err)
	}

	translateToDto := func(app *plugins.AppPlugin) *dtos.AppPlugin {
		return &dtos.AppPlugin{
			Name:    app.Name,
			Type:    app.Type,
			Enabled: app.Enabled,
			Pinned:  app.Pinned,
			Module:  app.Module,
		}
	}

	seenApps := make(map[string]bool)
	result := make([]*dtos.AppPlugin, 0)
	for _, orgApp := range query.Result {
		if def, ok := plugins.Apps[orgApp.Type]; ok {
			pluginDto := translateToDto(def)
			pluginDto.Enabled = orgApp.Enabled
			pluginDto.JsonData = orgApp.JsonData
			result = append(result, pluginDto)
			seenApps[orgApp.Type] = true
		}
	}

	for _, app := range plugins.Apps {
		if _, ok := seenApps[app.Type]; !ok {
			result = append(result, translateToDto(app))
		}
	}

	return Json(200, result)
}

func UpdateAppPlugin(c *middleware.Context, cmd m.UpdateAppPluginCmd) Response {
	cmd.OrgId = c.OrgId

	if _, ok := plugins.Apps[cmd.Type]; !ok {
		return ApiError(404, "App type not installed.", nil)
	}

	err := bus.Dispatch(&cmd)
	if err != nil {
		return ApiError(500, "Failed to update App Plugin", err)
	}

	return ApiSuccess("App updated")
}

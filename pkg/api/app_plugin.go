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

	installedAppsMap := make(map[string]*dtos.AppPlugin)
	for t, a := range plugins.Apps {
		installedAppsMap[t] = &dtos.AppPlugin{
			Type:     a.Type,
			Enabled:  a.Enabled,
			Module:   a.Module,
			JsonData: make(map[string]interface{}),
		}
	}

	seenApps := make(map[string]bool)

	result := make([]*dtos.AppPlugin, 0)
	for _, b := range query.Result {
		if def, ok := installedAppsMap[b.Type]; ok {
			result = append(result, &dtos.AppPlugin{
				Type:     b.Type,
				Enabled:  b.Enabled,
				Module:   def.Module,
				JsonData: b.JsonData,
			})
			seenApps[b.Type] = true
		}
	}

	for t, a := range installedAppsMap {
		if _, ok := seenApps[t]; !ok {
			result = append(result, a)
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

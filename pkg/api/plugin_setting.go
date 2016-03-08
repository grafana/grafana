package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

func GetPluginList(c *middleware.Context) Response {
	typeFilter := c.Query("type")
	enabledFilter := c.Query("enabled")
	embeddedFilter := c.Query("embedded")

	pluginSettingsMap, err := plugins.GetPluginSettings(c.OrgId)

	if err != nil {
		return ApiError(500, "Failed to get list of plugins", err)
	}

	result := make([]*dtos.PluginListItem, 0)
	for _, pluginDef := range plugins.Plugins {
		// filter out app sub plugins
		if embeddedFilter == "0" && pluginDef.IncludedInAppId != "" {
			continue
		}

		// filter on type
		if typeFilter != "" && typeFilter != pluginDef.Type {
			continue
		}

		listItem := &dtos.PluginListItem{
			Id:   pluginDef.Id,
			Name: pluginDef.Name,
			Type: pluginDef.Type,
			Info: &pluginDef.Info,
		}

		if pluginSetting, exists := pluginSettingsMap[pluginDef.Id]; exists {
			listItem.Enabled = pluginSetting.Enabled
			listItem.Pinned = pluginSetting.Pinned
		}

		// filter out disabled
		if enabledFilter == "1" && !listItem.Enabled {
			continue
		}

		result = append(result, listItem)
	}

	return Json(200, result)
}

func GetPluginSettingById(c *middleware.Context) Response {
	pluginId := c.Params(":pluginId")

	if def, exists := plugins.Plugins[pluginId]; !exists {
		return ApiError(404, "Plugin not found, no installed plugin with that id", nil)
	} else {

		dto := &dtos.PluginSetting{
			Type:         def.Type,
			Id:           def.Id,
			Name:         def.Name,
			Info:         &def.Info,
			Dependencies: &def.Dependencies,
			Includes:     def.Includes,
			BaseUrl:      def.BaseUrl,
			Module:       def.Module,
		}

		if app, exists := plugins.Apps[pluginId]; exists {
			dto.Pages = app.Pages
		}

		query := m.GetPluginSettingByIdQuery{PluginId: pluginId, OrgId: c.OrgId}
		if err := bus.Dispatch(&query); err != nil {
			if err != m.ErrPluginSettingNotFound {
				return ApiError(500, "Failed to get login settings", nil)
			}
		} else {
			dto.Enabled = query.Result.Enabled
			dto.Pinned = query.Result.Pinned
			dto.JsonData = query.Result.JsonData
		}

		return Json(200, dto)
	}
}

func UpdatePluginSetting(c *middleware.Context, cmd m.UpdatePluginSettingCmd) Response {
	pluginId := c.Params(":pluginId")

	cmd.OrgId = c.OrgId
	cmd.PluginId = pluginId

	if _, ok := plugins.Apps[cmd.PluginId]; !ok {
		return ApiError(404, "Plugin not installed.", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to update plugin setting", err)
	}

	return ApiSuccess("Plugin settings updated")
}

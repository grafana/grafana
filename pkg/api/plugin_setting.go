package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

func GetPluginList(c *middleware.Context) Response {
	pluginSettingsMap, err := plugins.GetPluginSettings(c.OrgId)

	if err != nil {
		return ApiError(500, "Failed to get list of plugins", err)
	}

	result := make([]*dtos.PluginListItem, 0)
	for _, pluginDef := range plugins.Plugins {
		listItem := &dtos.PluginListItem{
			PluginId: pluginDef.Id,
			Name:     pluginDef.Name,
			Type:     pluginDef.Type,
			Info:     &pluginDef.Info,
		}

		if pluginSetting, exists := pluginSettingsMap[pluginDef.Id]; exists {
			listItem.Enabled = pluginSetting.Enabled
			listItem.Pinned = pluginSetting.Pinned
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
			PluginId:     def.Id,
			Name:         def.Name,
			Info:         &def.Info,
			Dependencies: &def.Dependencies,
		}

		if app, exists := plugins.Apps[pluginId]; exists {
			dto.Pages = app.Pages
			dto.Includes = app.Includes
			dto.BaseUrl = app.BaseUrl
			dto.Module = app.Module
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

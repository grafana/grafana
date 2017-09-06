package api

import (
	"sort"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

func GetPluginList(c *middleware.Context) Response {
	typeFilter := c.Query("type")
	enabledFilter := c.Query("enabled")
	embeddedFilter := c.Query("embedded")
	coreFilter := c.Query("core")

	pluginSettingsMap, err := plugins.GetPluginSettings(c.OrgId)

	if err != nil {
		return ApiError(500, "Failed to get list of plugins", err)
	}

	result := make(dtos.PluginList, 0)
	for _, pluginDef := range plugins.Plugins {
		// filter out app sub plugins
		if embeddedFilter == "0" && pluginDef.IncludedInAppId != "" {
			continue
		}

		// filter out core plugins
		if coreFilter == "0" && pluginDef.IsCorePlugin {
			continue
		}

		// filter on type
		if typeFilter != "" && typeFilter != pluginDef.Type {
			continue
		}

		listItem := dtos.PluginListItem{
			Id:            pluginDef.Id,
			Name:          pluginDef.Name,
			Type:          pluginDef.Type,
			Info:          &pluginDef.Info,
			LatestVersion: pluginDef.GrafanaNetVersion,
			HasUpdate:     pluginDef.GrafanaNetHasUpdate,
			DefaultNavUrl: pluginDef.DefaultNavUrl,
			State:         pluginDef.State,
		}

		if pluginSetting, exists := pluginSettingsMap[pluginDef.Id]; exists {
			listItem.Enabled = pluginSetting.Enabled
			listItem.Pinned = pluginSetting.Pinned
		}

		if listItem.DefaultNavUrl == "" || !listItem.Enabled {
			listItem.DefaultNavUrl = setting.AppSubUrl + "/plugins/" + listItem.Id + "/edit"
		}

		// filter out disabled
		if enabledFilter == "1" && !listItem.Enabled {
			continue
		}

		// filter out built in data sources
		if ds, exists := plugins.DataSources[pluginDef.Id]; exists {
			if ds.BuiltIn {
				continue
			}
		}

		result = append(result, listItem)
	}

	sort.Sort(result)
	return Json(200, result)
}

func GetPluginSettingById(c *middleware.Context) Response {
	pluginId := c.Params(":pluginId")

	if def, exists := plugins.Plugins[pluginId]; !exists {
		return ApiError(404, "Plugin not found, no installed plugin with that id", nil)
	} else {

		dto := &dtos.PluginSetting{
			Type:          def.Type,
			Id:            def.Id,
			Name:          def.Name,
			Info:          &def.Info,
			Dependencies:  &def.Dependencies,
			Includes:      def.Includes,
			BaseUrl:       def.BaseUrl,
			Module:        def.Module,
			DefaultNavUrl: def.DefaultNavUrl,
			LatestVersion: def.GrafanaNetVersion,
			HasUpdate:     def.GrafanaNetHasUpdate,
			State:         def.State,
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

func GetPluginDashboards(c *middleware.Context) Response {
	pluginId := c.Params(":pluginId")

	if list, err := plugins.GetPluginDashboards(c.OrgId, pluginId); err != nil {
		if notfound, ok := err.(plugins.PluginNotFoundError); ok {
			return ApiError(404, notfound.Error(), nil)
		}

		return ApiError(500, "Failed to get plugin dashboards", err)
	} else {
		return Json(200, list)
	}
}

func GetPluginMarkdown(c *middleware.Context) Response {
	pluginId := c.Params(":pluginId")
	name := c.Params(":name")

	if content, err := plugins.GetPluginMarkdown(pluginId, name); err != nil {
		if notfound, ok := err.(plugins.PluginNotFoundError); ok {
			return ApiError(404, notfound.Error(), nil)
		}

		return ApiError(500, "Could not get markdown file", err)
	} else {
		return Respond(200, content)
	}
}

func ImportDashboard(c *middleware.Context, apiCmd dtos.ImportDashboardCommand) Response {

	cmd := plugins.ImportDashboardCommand{
		OrgId:     c.OrgId,
		UserId:    c.UserId,
		PluginId:  apiCmd.PluginId,
		Path:      apiCmd.Path,
		Inputs:    apiCmd.Inputs,
		Overwrite: apiCmd.Overwrite,
		Dashboard: apiCmd.Dashboard,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to import dashboard", err)
	}

	return Json(200, cmd.Result)
}

package api

import (
	"encoding/json"
	"sort"
	"time"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

func (hs *HTTPServer) GetPluginList(c *models.ReqContext) Response {
	typeFilter := c.Query("type")
	enabledFilter := c.Query("enabled")
	embeddedFilter := c.Query("embedded")
	coreFilter := c.Query("core")

	pluginSettingsMap, err := plugins.GetPluginSettings(c.OrgId)

	if err != nil {
		return Error(500, "Failed to get list of plugins", err)
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

		if pluginDef.State == plugins.PluginStateAlpha && !hs.Cfg.PluginsEnableAlpha {
			continue
		}

		listItem := dtos.PluginListItem{
			Id:            pluginDef.Id,
			Name:          pluginDef.Name,
			Type:          pluginDef.Type,
			Category:      pluginDef.Category,
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
			listItem.DefaultNavUrl = setting.AppSubUrl + "/plugins/" + listItem.Id + "/"
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
	return JSON(200, result)
}

func GetPluginSettingByID(c *models.ReqContext) Response {
	pluginID := c.Params(":pluginId")

	def, exists := plugins.Plugins[pluginID]
	if !exists {
		return Error(404, "Plugin not found, no installed plugin with that id", nil)
	}

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

	query := models.GetPluginSettingByIdQuery{PluginId: pluginID, OrgId: c.OrgId}
	if err := bus.Dispatch(&query); err != nil {
		if err != models.ErrPluginSettingNotFound {
			return Error(500, "Failed to get login settings", nil)
		}
	} else {
		dto.Enabled = query.Result.Enabled
		dto.Pinned = query.Result.Pinned
		dto.JsonData = query.Result.JsonData
	}

	return JSON(200, dto)
}

func UpdatePluginSetting(c *models.ReqContext, cmd models.UpdatePluginSettingCmd) Response {
	pluginID := c.Params(":pluginId")

	cmd.OrgId = c.OrgId
	cmd.PluginId = pluginID

	if _, ok := plugins.Apps[cmd.PluginId]; !ok {
		return Error(404, "Plugin not installed.", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to update plugin setting", err)
	}

	return Success("Plugin settings updated")
}

func GetPluginDashboards(c *models.ReqContext) Response {
	pluginID := c.Params(":pluginId")

	list, err := plugins.GetPluginDashboards(c.OrgId, pluginID)
	if err != nil {
		if notfound, ok := err.(plugins.PluginNotFoundError); ok {
			return Error(404, notfound.Error(), nil)
		}

		return Error(500, "Failed to get plugin dashboards", err)
	}

	return JSON(200, list)
}

func GetPluginMarkdown(c *models.ReqContext) Response {
	pluginID := c.Params(":pluginId")
	name := c.Params(":name")

	content, err := plugins.GetPluginMarkdown(pluginID, name)
	if err != nil {
		if notfound, ok := err.(plugins.PluginNotFoundError); ok {
			return Error(404, notfound.Error(), nil)
		}

		return Error(500, "Could not get markdown file", err)
	}

	// fallback try readme
	if len(content) == 0 {
		content, err = plugins.GetPluginMarkdown(pluginID, "readme")
		if err != nil {
			return Error(501, "Could not get markdown file", err)
		}
	}

	resp := Respond(200, content)
	resp.Header("Content-Type", "text/plain; charset=utf-8")
	return resp
}

func ImportDashboard(c *models.ReqContext, apiCmd dtos.ImportDashboardCommand) Response {
	if apiCmd.PluginId == "" && apiCmd.Dashboard == nil {
		return Error(422, "Dashboard must be set", nil)
	}

	cmd := plugins.ImportDashboardCommand{
		OrgId:     c.OrgId,
		User:      c.SignedInUser,
		PluginId:  apiCmd.PluginId,
		Path:      apiCmd.Path,
		Inputs:    apiCmd.Inputs,
		Overwrite: apiCmd.Overwrite,
		FolderId:  apiCmd.FolderId,
		Dashboard: apiCmd.Dashboard,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return dashboardSaveErrorToApiResponse(err)
	}

	return JSON(200, cmd.Result)
}

// /api/plugins/:pluginId/health
func (hs *HTTPServer) CheckHealth(c *models.ReqContext) Response {
	pluginID := c.Params("pluginId")
	resp, err := hs.BackendPluginManager.CheckHealth(c.Req.Context(), pluginID)
	if err != nil {
		if err == backendplugin.ErrPluginNotRegistered {
			return Error(404, "Plugin not found", err)
		}

		// Return status unknown instead?
		if err == backendplugin.ErrDiagnosticsNotSupported {
			return Error(404, "Health check not implemented", err)
		}

		// Return status unknown or error instead?
		if err == backendplugin.ErrHealthCheckFailed {
			return Error(500, "Plugin health check failed", err)
		}
	}

	payload := map[string]interface{}{
		"status": resp.Status.String(),
		"info":   resp.Info,
	}

	if resp.Status != backendplugin.HealthStatusOk {
		return JSON(503, payload)
	}

	return JSON(200, payload)
}

// /api/plugins/:pluginId/resources/*
func (hs *HTTPServer) CallResource(c *models.ReqContext) Response {
	pluginID := c.Params("pluginId")
	plugin, exists := plugins.Plugins[pluginID]
	if !exists {
		return Error(404, "Plugin not found, no installed plugin with that id", nil)
	}

	var jsonDataBytes []byte
	var decryptedSecureJSONData map[string]string
	var updated time.Time

	ps, err := hs.getCachedPluginSettings(pluginID, c.SignedInUser)
	if err != nil {
		if err != models.ErrPluginSettingNotFound {
			return Error(500, "Failed to get plugin settings", err)
		}
	} else {
		jsonDataBytes, err = json.Marshal(&ps.JsonData)
		if err != nil {
			return Error(500, "Failed to marshal JSON data to bytes", err)
		}

		decryptedSecureJSONData = ps.DecryptedValues()
		updated = ps.Updated
	}

	body, err := c.Req.Body().Bytes()
	if err != nil {
		return Error(500, "Failed to read request body", err)
	}

	req := backendplugin.CallResourceRequest{
		Config: backendplugin.PluginConfig{
			OrgID:                   c.OrgId,
			PluginID:                plugin.Id,
			PluginType:              plugin.Type,
			JSONData:                jsonDataBytes,
			DecryptedSecureJSONData: decryptedSecureJSONData,
			Updated:                 updated,
		},
		Path:    c.Params("*"),
		Method:  c.Req.Method,
		URL:     c.Req.URL.String(),
		Headers: c.Req.Header.Clone(),
		Body:    body,
	}
	resp, err := hs.BackendPluginManager.CallResource(c.Req.Context(), req)
	if err != nil {
		return Error(500, "Failed to call resource", err)
	}

	if resp.Status >= 400 {
		return Error(resp.Status, "", nil)
	}

	return &NormalResponse{
		body:   resp.Body,
		status: resp.Status,
		header: resp.Headers,
	}
}

func (hs *HTTPServer) getCachedPluginSettings(pluginID string, user *models.SignedInUser) (*models.PluginSetting, error) {
	cacheKey := "plugin-setting-" + pluginID

	if cached, found := hs.CacheService.Get(cacheKey); found {
		ps := cached.(*models.PluginSetting)
		if ps.OrgId == user.OrgId {
			return ps, nil
		}
	}

	query := models.GetPluginSettingByIdQuery{PluginId: pluginID, OrgId: user.OrgId}
	if err := hs.Bus.Dispatch(&query); err != nil {
		return nil, err
	}

	hs.CacheService.Set(cacheKey, query.Result, time.Second*5)
	return query.Result, nil
}

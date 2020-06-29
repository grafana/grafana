package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/datasource/wrapper"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// ErrPluginNotFound is returned when an requested plugin is not installed.
var ErrPluginNotFound error = errors.New("plugin not found, no installed plugin with that id")

func (hs *HTTPServer) getPluginContext(pluginID string, user *models.SignedInUser) (backend.PluginContext, error) {
	pc := backend.PluginContext{}
	plugin, exists := plugins.Plugins[pluginID]
	if !exists {
		return pc, ErrPluginNotFound
	}

	jsonData := json.RawMessage{}
	decryptedSecureJSONData := map[string]string{}
	var updated time.Time

	ps, err := hs.getCachedPluginSettings(pluginID, user)
	if err != nil {
		// models.ErrPluginSettingNotFound is expected if there's no row found for plugin setting in database (if non-app plugin).
		// If it's not this expected error something is wrong with cache or database and we return the error to the client.
		if err != models.ErrPluginSettingNotFound {
			return pc, errutil.Wrap("Failed to get plugin settings", err)
		}
	} else {
		jsonData, err = json.Marshal(ps.JsonData)
		if err != nil {
			return pc, errutil.Wrap("Failed to unmarshal plugin json data", err)
		}
		decryptedSecureJSONData = ps.DecryptedValues()
		updated = ps.Updated
	}

	return backend.PluginContext{
		OrgID:    user.OrgId,
		PluginID: plugin.Id,
		User:     wrapper.BackendUserFromSignedInUser(user),
		AppInstanceSettings: &backend.AppInstanceSettings{
			JSONData:                jsonData,
			DecryptedSecureJSONData: decryptedSecureJSONData,
			Updated:                 updated,
		},
	}, nil
}

func (hs *HTTPServer) GetPluginList(c *models.ReqContext) Response {
	typeFilter := c.Query("type")
	enabledFilter := c.Query("enabled")
	embeddedFilter := c.Query("embedded")
	coreFilter := c.Query("core")

	// For users with viewer role we only return core plugins
	if !c.HasRole(models.ROLE_ADMIN) {
		coreFilter = "1"
	}

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
		if (coreFilter == "0" && pluginDef.IsCorePlugin) || (coreFilter == "1" && !pluginDef.IsCorePlugin) {
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
			Signature:     pluginDef.Signature,
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
		Signature:     def.Signature,
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

// CollectPluginMetrics collect metrics from a plugin.
//
// /api/plugins/:pluginId/metrics
func (hs *HTTPServer) CollectPluginMetrics(c *models.ReqContext) Response {
	pluginID := c.Params("pluginId")
	plugin, exists := plugins.Plugins[pluginID]
	if !exists {
		return Error(404, "Plugin not found", nil)
	}

	resp, err := hs.BackendPluginManager.CollectMetrics(c.Req.Context(), plugin.Id)
	if err != nil {
		return translatePluginRequestErrorToAPIError(err)
	}

	headers := make(http.Header)
	headers.Set("Content-Type", "text/plain")

	return &NormalResponse{
		header: headers,
		body:   resp.PrometheusMetrics,
		status: http.StatusOK,
	}
}

// CheckHealth returns the health of a plugin.
// /api/plugins/:pluginId/health
func (hs *HTTPServer) CheckHealth(c *models.ReqContext) Response {
	pluginID := c.Params("pluginId")

	pCtx, err := hs.getPluginContext(pluginID, c.SignedInUser)
	if err != nil {
		if err == ErrPluginNotFound {
			return Error(404, "Plugin not found", nil)
		}

		return Error(500, "Failed to get plugin settings", err)
	}

	resp, err := hs.BackendPluginManager.CheckHealth(c.Req.Context(), pCtx)
	if err != nil {
		return translatePluginRequestErrorToAPIError(err)
	}

	payload := map[string]interface{}{
		"status":  resp.Status.String(),
		"message": resp.Message,
	}

	// Unmarshal JSONDetails if it's not empty.
	if len(resp.JSONDetails) > 0 {
		var jsonDetails map[string]interface{}
		err = json.Unmarshal(resp.JSONDetails, &jsonDetails)
		if err != nil {
			return Error(500, "Failed to unmarshal detailed response from backend plugin", err)
		}

		payload["details"] = jsonDetails
	}

	if resp.Status != backend.HealthStatusOk {
		return JSON(503, payload)
	}

	return JSON(200, payload)
}

// CallResource passes a resource call from a plugin to the backend plugin.
//
// /api/plugins/:pluginId/resources/*
func (hs *HTTPServer) CallResource(c *models.ReqContext) {
	pluginID := c.Params("pluginId")

	pCtx, err := hs.getPluginContext(pluginID, c.SignedInUser)
	if err != nil {
		if err == ErrPluginNotFound {
			c.JsonApiErr(404, "Plugin not found", nil)
			return
		}

		c.JsonApiErr(500, "Failed to get plugin settings", err)
		return
	}
	hs.BackendPluginManager.CallResource(pCtx, c, c.Params("*"))
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

func translatePluginRequestErrorToAPIError(err error) Response {
	if errors.Is(err, backendplugin.ErrPluginNotRegistered) {
		return Error(404, "Plugin not found", err)
	}

	if errors.Is(err, backendplugin.ErrMethodNotImplemented) {
		return Error(404, "Not found", err)
	}

	if errors.Is(err, backendplugin.ErrHealthCheckFailed) {
		return Error(500, "Plugin health check failed", err)
	}

	if errors.Is(err, backendplugin.ErrPluginUnavailable) {
		return Error(503, "Plugin unavailable", err)
	}

	return Error(500, "Plugin request failed", err)
}

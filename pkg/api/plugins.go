package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/installer"
	"github.com/grafana/grafana/pkg/setting"
)

func (hs *HTTPServer) GetPluginList(c *models.ReqContext) response.Response {
	typeFilter := c.Query("type")
	enabledFilter := c.Query("enabled")
	embeddedFilter := c.Query("embedded")
	coreFilter := c.Query("core")

	// For users with viewer role we only return core plugins
	if !c.HasRole(models.ROLE_ADMIN) {
		coreFilter = "1"
	}

	pluginSettingsMap, err := hs.PluginManager.GetPluginSettings(c.OrgId)
	if err != nil {
		return response.Error(500, "Failed to get list of plugins", err)
	}

	result := make(dtos.PluginList, 0)
	for _, pluginDef := range hs.PluginManager.Plugins() {
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
			SignatureType: pluginDef.SignatureType,
			SignatureOrg:  pluginDef.SignatureOrg,
		}

		if pluginSetting, exists := pluginSettingsMap[pluginDef.Id]; exists {
			listItem.Enabled = pluginSetting.Enabled
			listItem.Pinned = pluginSetting.Pinned
		}

		if listItem.DefaultNavUrl == "" || !listItem.Enabled {
			listItem.DefaultNavUrl = hs.Cfg.AppSubURL + "/plugins/" + listItem.Id + "/"
		}

		// filter out disabled plugins
		if enabledFilter == "1" && !listItem.Enabled {
			continue
		}

		// filter out built in data sources
		if ds := hs.PluginManager.GetDataSource(pluginDef.Id); ds != nil {
			if ds.BuiltIn {
				continue
			}
		}

		result = append(result, listItem)
	}

	sort.Sort(result)
	return response.JSON(200, result)
}

func (hs *HTTPServer) GetPluginSettingByID(c *models.ReqContext) response.Response {
	pluginID := c.Params(":pluginId")

	def := hs.PluginManager.GetPlugin(pluginID)
	if def == nil {
		return response.Error(404, "Plugin not found, no installed plugin with that id", nil)
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
		SignatureType: def.SignatureType,
		SignatureOrg:  def.SignatureOrg,
	}

	if app := hs.PluginManager.GetApp(def.Id); app != nil {
		dto.Enabled = app.AutoEnabled
		dto.Pinned = app.AutoEnabled
	}

	query := models.GetPluginSettingByIdQuery{PluginId: pluginID, OrgId: c.OrgId}
	if err := bus.Dispatch(&query); err != nil {
		if !errors.Is(err, models.ErrPluginSettingNotFound) {
			return response.Error(500, "Failed to get login settings", nil)
		}
	} else {
		dto.Enabled = query.Result.Enabled
		dto.Pinned = query.Result.Pinned
		dto.JsonData = query.Result.JsonData
	}

	return response.JSON(200, dto)
}

func (hs *HTTPServer) UpdatePluginSetting(c *models.ReqContext, cmd models.UpdatePluginSettingCmd) response.Response {
	pluginID := c.Params(":pluginId")

	if app := hs.PluginManager.GetApp(pluginID); app == nil {
		return response.Error(404, "Plugin not installed", nil)
	}

	cmd.OrgId = c.OrgId
	cmd.PluginId = pluginID
	if err := bus.Dispatch(&cmd); err != nil {
		return response.Error(500, "Failed to update plugin setting", err)
	}

	return response.Success("Plugin settings updated")
}

func (hs *HTTPServer) GetPluginDashboards(c *models.ReqContext) response.Response {
	pluginID := c.Params(":pluginId")

	list, err := hs.PluginManager.GetPluginDashboards(c.OrgId, pluginID)
	if err != nil {
		var notFound plugins.PluginNotFoundError
		if errors.As(err, &notFound) {
			return response.Error(404, notFound.Error(), nil)
		}

		return response.Error(500, "Failed to get plugin dashboards", err)
	}

	return response.JSON(200, list)
}

func (hs *HTTPServer) GetPluginMarkdown(c *models.ReqContext) response.Response {
	pluginID := c.Params(":pluginId")
	name := c.Params(":name")

	content, err := hs.PluginManager.GetPluginMarkdown(pluginID, name)
	if err != nil {
		var notFound plugins.PluginNotFoundError
		if errors.As(err, &notFound) {
			return response.Error(404, notFound.Error(), nil)
		}

		return response.Error(500, "Could not get markdown file", err)
	}

	// fallback try readme
	if len(content) == 0 {
		content, err = hs.PluginManager.GetPluginMarkdown(pluginID, "readme")
		if err != nil {
			return response.Error(501, "Could not get markdown file", err)
		}
	}

	resp := response.Respond(200, content)
	resp.SetHeader("Content-Type", "text/plain; charset=utf-8")
	return resp
}

func (hs *HTTPServer) ImportDashboard(c *models.ReqContext, apiCmd dtos.ImportDashboardCommand) response.Response {
	var err error
	if apiCmd.PluginId == "" && apiCmd.Dashboard == nil {
		return response.Error(422, "Dashboard must be set", nil)
	}

	trimDefaults := c.QueryBoolWithDefault("trimdefaults", true)
	if trimDefaults && !hs.LoadSchemaService.IsDisabled() {
		apiCmd.Dashboard, err = hs.LoadSchemaService.DashboardApplyDefaults(apiCmd.Dashboard)
		if err != nil {
			return response.Error(500, "Error while applying default value to the dashboard json", err)
		}
	}

	dashInfo, dash, err := hs.PluginManager.ImportDashboard(apiCmd.PluginId, apiCmd.Path, c.OrgId, apiCmd.FolderId,
		apiCmd.Dashboard, apiCmd.Overwrite, apiCmd.Inputs, c.SignedInUser, hs.DataService)
	if err != nil {
		return hs.dashboardSaveErrorToApiResponse(err)
	}

	err = hs.LibraryPanelService.ConnectLibraryPanelsForDashboard(c, dash)
	if err != nil {
		return response.Error(500, "Error while connecting library panels", err)
	}

	return response.JSON(200, dashInfo)
}

// CollectPluginMetrics collect metrics from a plugin.
//
// /api/plugins/:pluginId/metrics
func (hs *HTTPServer) CollectPluginMetrics(c *models.ReqContext) response.Response {
	pluginID := c.Params("pluginId")
	plugin := hs.PluginManager.GetPlugin(pluginID)
	if plugin == nil {
		return response.Error(404, "Plugin not found", nil)
	}

	resp, err := hs.BackendPluginManager.CollectMetrics(c.Req.Context(), plugin.Id)
	if err != nil {
		return translatePluginRequestErrorToAPIError(err)
	}

	headers := make(http.Header)
	headers.Set("Content-Type", "text/plain")

	return response.CreateNormalResponse(headers, resp.PrometheusMetrics, http.StatusOK)
}

// GetPluginAssets returns public plugin assets (images, JS, etc.)
//
// /public/plugins/:pluginId/*
func (hs *HTTPServer) GetPluginAssets(c *models.ReqContext) {
	pluginID := c.Params("pluginId")
	plugin := hs.PluginManager.GetPlugin(pluginID)
	if plugin == nil {
		c.JsonApiErr(404, "Plugin not found", nil)
		return
	}

	requestedFile := filepath.Clean(c.Params("*"))
	pluginFilePath := filepath.Join(plugin.PluginDir, requestedFile)

	// It's safe to ignore gosec warning G304 since we already clean the requested file path and subsequently
	// use this with a prefix of the plugin's directory, which is set during plugin loading
	// nolint:gosec
	f, err := os.Open(pluginFilePath)
	if err != nil {
		if os.IsNotExist(err) {
			c.JsonApiErr(404, "Plugin file not found", err)
			return
		}
		c.JsonApiErr(500, "Could not open plugin file", err)
		return
	}
	defer func() {
		if err := f.Close(); err != nil {
			hs.log.Error("Failed to close file", "err", err)
		}
	}()

	fi, err := f.Stat()
	if err != nil {
		c.JsonApiErr(500, "Plugin file exists but could not open", err)
		return
	}

	if shouldExclude(fi) {
		c.JsonApiErr(403, "Plugin file access forbidden",
			fmt.Errorf("access is forbidden to executable plugin file %s", pluginFilePath))
		return
	}

	if hs.Cfg.Env == setting.Dev {
		c.Resp.Header().Set("Cache-Control", "max-age=0, must-revalidate, no-cache")
	} else {
		c.Resp.Header().Set("Cache-Control", "public, max-age=3600")
	}

	http.ServeContent(c.Resp, c.Req.Request, pluginFilePath, fi.ModTime(), f)
}

// CheckHealth returns the health of a plugin.
// /api/plugins/:pluginId/health
func (hs *HTTPServer) CheckHealth(c *models.ReqContext) response.Response {
	pluginID := c.Params("pluginId")

	pCtx, found, err := hs.PluginContextProvider.Get(pluginID, "", c.SignedInUser, false)
	if err != nil {
		return response.Error(500, "Failed to get plugin settings", err)
	}
	if !found {
		return response.Error(404, "Plugin not found", nil)
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
			return response.Error(500, "Failed to unmarshal detailed response from backend plugin", err)
		}

		payload["details"] = jsonDetails
	}

	if resp.Status != backend.HealthStatusOk {
		return response.JSON(503, payload)
	}

	return response.JSON(200, payload)
}

// CallResource passes a resource call from a plugin to the backend plugin.
//
// /api/plugins/:pluginId/resources/*
func (hs *HTTPServer) CallResource(c *models.ReqContext) {
	pluginID := c.Params("pluginId")

	pCtx, found, err := hs.PluginContextProvider.Get(pluginID, "", c.SignedInUser, false)
	if err != nil {
		c.JsonApiErr(500, "Failed to get plugin settings", err)
		return
	}
	if !found {
		c.JsonApiErr(404, "Plugin not found", nil)
		return
	}
	hs.BackendPluginManager.CallResource(pCtx, c, c.Params("*"))
}

func (hs *HTTPServer) GetPluginErrorsList(_ *models.ReqContext) response.Response {
	return response.JSON(200, hs.PluginManager.ScanningErrors())
}

func (hs *HTTPServer) InstallPlugin(c *models.ReqContext, dto dtos.InstallPluginCommand) response.Response {
	pluginID := c.Params("pluginId")

	err := hs.PluginManager.Install(c.Req.Context(), pluginID, dto.Version)
	if err != nil {
		var dupeErr plugins.DuplicatePluginError
		if errors.As(err, &dupeErr) {
			return response.Error(http.StatusConflict, "Plugin already installed", err)
		}
		var versionUnsupportedErr installer.ErrVersionUnsupported
		if errors.As(err, &versionUnsupportedErr) {
			return response.Error(http.StatusConflict, "Plugin version not supported", err)
		}
		var versionNotFoundErr installer.ErrVersionNotFound
		if errors.As(err, &versionNotFoundErr) {
			return response.Error(http.StatusNotFound, "Plugin version not found", err)
		}
		var clientError installer.Response4xxError
		if errors.As(err, &clientError) {
			return response.Error(clientError.StatusCode, clientError.Message, err)
		}
		if errors.Is(err, plugins.ErrInstallCorePlugin) {
			return response.Error(http.StatusForbidden, "Cannot install or change a Core plugin", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to install plugin", err)
	}

	return response.JSON(http.StatusOK, []byte{})
}

func (hs *HTTPServer) UninstallPlugin(c *models.ReqContext) response.Response {
	pluginID := c.Params("pluginId")

	err := hs.PluginManager.Uninstall(c.Req.Context(), pluginID)
	if err != nil {
		if errors.Is(err, plugins.ErrPluginNotInstalled) {
			return response.Error(http.StatusNotFound, "Plugin not installed", err)
		}
		if errors.Is(err, plugins.ErrUninstallCorePlugin) {
			return response.Error(http.StatusForbidden, "Cannot uninstall a Core plugin", err)
		}
		if errors.Is(err, plugins.ErrUninstallOutsideOfPluginDir) {
			return response.Error(http.StatusForbidden, "Cannot uninstall a plugin outside of the plugins directory", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to uninstall plugin", err)
	}
	return response.JSON(http.StatusOK, []byte{})
}

func translatePluginRequestErrorToAPIError(err error) response.Response {
	if errors.Is(err, backendplugin.ErrPluginNotRegistered) {
		return response.Error(404, "Plugin not found", err)
	}

	if errors.Is(err, backendplugin.ErrMethodNotImplemented) {
		return response.Error(404, "Not found", err)
	}

	if errors.Is(err, backendplugin.ErrHealthCheckFailed) {
		return response.Error(500, "Plugin health check failed", err)
	}

	if errors.Is(err, backendplugin.ErrPluginUnavailable) {
		return response.Error(503, "Plugin unavailable", err)
	}

	return response.Error(500, "Plugin request failed", err)
}

func shouldExclude(fi os.FileInfo) bool {
	normalizedFilename := strings.ToLower(fi.Name())

	isUnixExecutable := fi.Mode()&0111 == 0111
	isWindowsExecutable := strings.HasSuffix(normalizedFilename, ".exe")
	isScript := strings.HasSuffix(normalizedFilename, ".sh")

	return isUnixExecutable || isWindowsExecutable || isScript
}

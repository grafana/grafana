package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/installer"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
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

	pluginSettingsMap, err := hs.pluginSettings(c.Req.Context(), c.OrgId)
	if err != nil {
		return response.Error(500, "Failed to get list of plugins", err)
	}

	result := make(dtos.PluginList, 0)
	for _, pluginDef := range hs.pluginStore.Plugins() {
		// filter out app sub plugins
		if embeddedFilter == "0" && pluginDef.IncludedInAppID != "" {
			continue
		}

		// filter out core plugins
		if (coreFilter == "0" && pluginDef.IsCorePlugin()) || (coreFilter == "1" && !pluginDef.IsCorePlugin()) {
			continue
		}

		// filter on type
		if typeFilter != "" && typeFilter != string(pluginDef.Type) {
			continue
		}

		if pluginDef.State == plugins.AlphaRelease && !hs.Cfg.PluginsEnableAlpha {
			continue
		}

		listItem := dtos.PluginListItem{
			Id:            pluginDef.ID,
			Name:          pluginDef.Name,
			Type:          string(pluginDef.Type),
			Category:      pluginDef.Category,
			Info:          &pluginDef.Info,
			Dependencies:  &pluginDef.Dependencies,
			LatestVersion: pluginDef.GrafanaComVersion,
			HasUpdate:     pluginDef.GrafanaComHasUpdate,
			DefaultNavUrl: pluginDef.DefaultNavURL,
			State:         pluginDef.State,
			Signature:     pluginDef.Signature,
			SignatureType: pluginDef.SignatureType,
			SignatureOrg:  pluginDef.SignatureOrg,
		}

		if pluginSetting, exists := pluginSettingsMap[pluginDef.ID]; exists {
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

		// filter out built in plugins
		if pluginDef.BuiltIn {
			continue
		}

		result = append(result, listItem)
	}

	sort.Sort(result)
	return response.JSON(200, result)
}

func (hs *HTTPServer) GetPluginSettingByID(c *models.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]

	def := hs.pluginStore.Plugin(pluginID)
	if def == nil {
		return response.Error(404, "Plugin not found, no installed plugin with that id", nil)
	}

	dto := &dtos.PluginSetting{
		Type:          string(def.Type),
		Id:            def.ID,
		Name:          def.Name,
		Info:          &def.Info,
		Dependencies:  &def.Dependencies,
		Includes:      def.Includes,
		BaseUrl:       def.BaseURL,
		Module:        def.Module,
		DefaultNavUrl: def.DefaultNavURL,
		LatestVersion: def.GrafanaComVersion,
		HasUpdate:     def.GrafanaComHasUpdate,
		State:         def.State,
		Signature:     def.Signature,
		SignatureType: def.SignatureType,
		SignatureOrg:  def.SignatureOrg,
	}

	if def.IsApp() {
		dto.Enabled = def.AutoEnabled
		dto.Pinned = def.AutoEnabled
	}

	query := models.GetPluginSettingByIdQuery{PluginId: pluginID, OrgId: c.OrgId}
	if err := bus.DispatchCtx(c.Req.Context(), &query); err != nil {
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
	pluginID := web.Params(c.Req)[":pluginId"]

	if app := hs.pluginStore.Plugin(pluginID); app == nil {
		return response.Error(404, "Plugin not installed", nil)
	}

	cmd.OrgId = c.OrgId
	cmd.PluginId = pluginID
	if err := bus.DispatchCtx(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to update plugin setting", err)
	}

	return response.Success("Plugin settings updated")
}

func (hs *HTTPServer) GetPluginDashboards(c *models.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]

	list, err := hs.pluginDashboardManager.GetPluginDashboards(c.OrgId, pluginID)
	if err != nil {
		var notFound plugins.NotFoundError
		if errors.As(err, &notFound) {
			return response.Error(404, notFound.Error(), nil)
		}

		return response.Error(500, "Failed to get plugin dashboards", err)
	}

	return response.JSON(200, list)
}

func (hs *HTTPServer) GetPluginMarkdown(c *models.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]
	name := web.Params(c.Req)[":name"]

	content, err := hs.pluginMarkdown(pluginID, name)
	if err != nil {
		var notFound plugins.NotFoundError
		if errors.As(err, &notFound) {
			return response.Error(404, notFound.Error(), nil)
		}

		return response.Error(500, "Could not get markdown file", err)
	}

	// fallback try readme
	if len(content) == 0 {
		content, err = hs.pluginMarkdown(pluginID, "readme")
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

	dashInfo, dash, err := hs.pluginDashboardManager.ImportDashboard(c.Req.Context(), apiCmd.PluginId, apiCmd.Path, c.OrgId, apiCmd.FolderId,
		apiCmd.Dashboard, apiCmd.Overwrite, apiCmd.Inputs, c.SignedInUser)
	if err != nil {
		return hs.dashboardSaveErrorToApiResponse(err)
	}

	err = hs.LibraryPanelService.ImportLibraryPanelsForDashboard(c.Req.Context(), c.SignedInUser, dash, apiCmd.FolderId)
	if err != nil {
		return response.Error(500, "Error while importing library panels", err)
	}

	err = hs.LibraryPanelService.ConnectLibraryPanelsForDashboard(c.Req.Context(), c.SignedInUser, dash)
	if err != nil {
		return response.Error(500, "Error while connecting library panels", err)
	}

	return response.JSON(200, dashInfo)
}

// CollectPluginMetrics collect metrics from a plugin.
//
// /api/plugins/:pluginId/metrics
func (hs *HTTPServer) CollectPluginMetrics(c *models.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]
	plugin := hs.pluginStore.Plugin(pluginID)
	if plugin == nil {
		return response.Error(404, "Plugin not found", nil)
	}

	resp, err := hs.pluginClient.CollectMetrics(c.Req.Context(), plugin.ID)
	if err != nil {
		return translatePluginRequestErrorToAPIError(err)
	}

	headers := make(http.Header)
	headers.Set("Content-Type", "text/plain")

	return response.CreateNormalResponse(headers, resp.PrometheusMetrics, http.StatusOK)
}

// getPluginAssets returns public plugin assets (images, JS, etc.)
//
// /public/plugins/:pluginId/*
func (hs *HTTPServer) getPluginAssets(c *models.ReqContext) {
	pluginID := web.Params(c.Req)[":pluginId"]
	plugin := hs.pluginStore.Plugin(pluginID)
	if plugin == nil {
		c.JsonApiErr(404, "Plugin not found", nil)
		return
	}

	requestedFile := filepath.Clean(web.Params(c.Req)["*"])
	pluginFilePath := filepath.Join(plugin.PluginDir, requestedFile)

	if !plugin.IncludedInSignature(requestedFile) {
		hs.log.Warn("Access to requested plugin file will be forbidden in upcoming Grafana versions as the file "+
			"is not included in the plugin signature", "file", requestedFile)
	}

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

	if hs.Cfg.Env == setting.Dev {
		c.Resp.Header().Set("Cache-Control", "max-age=0, must-revalidate, no-cache")
	} else {
		c.Resp.Header().Set("Cache-Control", "public, max-age=3600")
	}

	http.ServeContent(c.Resp, c.Req, pluginFilePath, fi.ModTime(), f)
}

// CheckHealth returns the health of a plugin.
// /api/plugins/:pluginId/health
func (hs *HTTPServer) CheckHealth(c *models.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]

	pCtx, found, err := hs.PluginContextProvider.Get(c.Req.Context(), pluginID, "", c.SignedInUser, false)
	if err != nil {
		return response.Error(500, "Failed to get plugin settings", err)
	}
	if !found {
		return response.Error(404, "Plugin not found", nil)
	}

	resp, err := hs.pluginClient.CheckHealth(c.Req.Context(), &backend.CheckHealthRequest{
		PluginContext: pCtx,
	})
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
	pluginID := web.Params(c.Req)[":pluginId"]

	pCtx, found, err := hs.PluginContextProvider.Get(c.Req.Context(), pluginID, "", c.SignedInUser, false)
	if err != nil {
		c.JsonApiErr(500, "Failed to get plugin settings", err)
		return
	}
	if !found {
		c.JsonApiErr(404, "Plugin not found", nil)
		return
	}
	hs.pluginClient.CallResource(pCtx, c, web.Params(c.Req)["*"])
}

func (hs *HTTPServer) GetPluginErrorsList(_ *models.ReqContext) response.Response {
	return response.JSON(200, hs.pluginErrorResolver.PluginErrors())
}

func (hs *HTTPServer) InstallPlugin(c *models.ReqContext, dto dtos.InstallPluginCommand) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]

	err := hs.pluginStore.Add(c.Req.Context(), pluginID, dto.Version, plugins.AddOpts{})
	if err != nil {
		var dupeErr plugins.DuplicateError
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
	pluginID := web.Params(c.Req)[":pluginId"]

	err := hs.pluginStore.Remove(c.Req.Context(), pluginID)
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

func (hs *HTTPServer) pluginMarkdown(pluginId string, name string) ([]byte, error) {
	plug := hs.pluginStore.Plugin(pluginId)
	if plug == nil {
		return nil, plugins.NotFoundError{PluginID: pluginId}
	}

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `plug.PluginDir` is based
	// on plugin the folder structure on disk and not user input.
	path := filepath.Join(plug.PluginDir, fmt.Sprintf("%s.md", strings.ToUpper(name)))
	exists, err := fs.Exists(path)
	if err != nil {
		return nil, err
	}
	if !exists {
		path = filepath.Join(plug.PluginDir, fmt.Sprintf("%s.md", strings.ToLower(name)))
	}

	exists, err = fs.Exists(path)
	if err != nil {
		return nil, err
	}
	if !exists {
		return make([]byte, 0), nil
	}

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `plug.PluginDir` is based
	// on plugin the folder structure on disk and not user input.
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return data, nil
}

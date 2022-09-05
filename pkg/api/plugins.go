package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetPluginList(c *models.ReqContext) response.Response {
	typeFilter := c.Query("type")
	enabledFilter := c.Query("enabled")
	embeddedFilter := c.Query("embedded")
	coreFilter := c.Query("core")

	// When using access control anyone that can create a data source should be able to list all data sources installed
	// Fallback to only letting admins list non-core plugins
	hasAccess := accesscontrol.HasAccess(hs.AccessControl, c)
	if !hasAccess(accesscontrol.ReqOrgAdmin, accesscontrol.EvalPermission(datasources.ActionCreate)) && !c.HasRole(org.RoleAdmin) {
		coreFilter = "1"
	}

	pluginSettingsMap, err := hs.pluginSettings(c.Req.Context(), c.OrgID)
	if err != nil {
		return response.Error(500, "Failed to get list of plugins", err)
	}

	result := make(dtos.PluginList, 0)
	for _, pluginDef := range hs.pluginStore.Plugins(c.Req.Context()) {
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
			Info:          pluginDef.Info,
			Dependencies:  pluginDef.Dependencies,
			DefaultNavUrl: path.Join(hs.Cfg.AppSubURL, pluginDef.DefaultNavURL),
			State:         pluginDef.State,
			Signature:     pluginDef.Signature,
			SignatureType: pluginDef.SignatureType,
			SignatureOrg:  pluginDef.SignatureOrg,
		}

		update, exists := hs.pluginsUpdateChecker.HasUpdate(c.Req.Context(), pluginDef.ID)
		if exists {
			listItem.LatestVersion = update
			listItem.HasUpdate = true
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
	return response.JSON(http.StatusOK, result)
}

func (hs *HTTPServer) GetPluginSettingByID(c *models.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]

	plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), pluginID)
	if !exists {
		return response.Error(http.StatusNotFound, "Plugin not found, no installed plugin with that id", nil)
	}

	// In a first iteration, we only have one permission for app plugins.
	// We will need a different permission to allow users to configure the plugin without needing access to it.
	if plugin.IsApp() {
		hasAccess := accesscontrol.HasAccess(hs.AccessControl, c)
		if !hasAccess(accesscontrol.ReqSignedIn,
			accesscontrol.EvalPermission(plugins.ActionAppAccess, plugins.ScopeProvider.GetResourceScope(plugin.ID))) {
			return response.Error(http.StatusForbidden, "Access Denied", nil)
		}
	}

	dto := &dtos.PluginSetting{
		Type:          string(plugin.Type),
		Id:            plugin.ID,
		Name:          plugin.Name,
		Info:          plugin.Info,
		Dependencies:  plugin.Dependencies,
		Includes:      plugin.Includes,
		BaseUrl:       plugin.BaseURL,
		Module:        plugin.Module,
		DefaultNavUrl: path.Join(hs.Cfg.AppSubURL, plugin.DefaultNavURL),
		State:         plugin.State,
		Signature:     plugin.Signature,
		SignatureType: plugin.SignatureType,
		SignatureOrg:  plugin.SignatureOrg,
	}

	if plugin.IsApp() {
		dto.Enabled = plugin.AutoEnabled
		dto.Pinned = plugin.AutoEnabled
	}

	ps, err := hs.PluginSettings.GetPluginSettingByPluginID(c.Req.Context(), &pluginsettings.GetByPluginIDArgs{
		PluginID: pluginID,
		OrgID:    c.OrgID,
	})
	if err != nil {
		if !errors.Is(err, models.ErrPluginSettingNotFound) {
			return response.Error(http.StatusInternalServerError, "Failed to get plugin settings", nil)
		}
	} else {
		dto.Enabled = ps.Enabled
		dto.Pinned = ps.Pinned
		dto.JsonData = ps.JSONData
	}

	update, exists := hs.pluginsUpdateChecker.HasUpdate(c.Req.Context(), plugin.ID)
	if exists {
		dto.LatestVersion = update
		dto.HasUpdate = true
	}

	return response.JSON(http.StatusOK, dto)
}

func (hs *HTTPServer) UpdatePluginSetting(c *models.ReqContext) response.Response {
	cmd := models.UpdatePluginSettingCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	pluginID := web.Params(c.Req)[":pluginId"]

	if _, exists := hs.pluginStore.Plugin(c.Req.Context(), pluginID); !exists {
		return response.Error(404, "Plugin not installed", nil)
	}

	cmd.OrgId = c.OrgID
	cmd.PluginId = pluginID
	if err := hs.PluginSettings.UpdatePluginSetting(c.Req.Context(), &pluginsettings.UpdateArgs{
		Enabled:                 cmd.Enabled,
		Pinned:                  cmd.Pinned,
		JSONData:                cmd.JsonData,
		SecureJSONData:          cmd.SecureJsonData,
		PluginVersion:           cmd.PluginVersion,
		PluginID:                cmd.PluginId,
		OrgID:                   cmd.OrgId,
		EncryptedSecureJSONData: cmd.EncryptedSecureJsonData,
	}); err != nil {
		return response.Error(500, "Failed to update plugin setting", err)
	}

	return response.Success("Plugin settings updated")
}

func (hs *HTTPServer) GetPluginMarkdown(c *models.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]
	name := web.Params(c.Req)[":name"]

	content, err := hs.pluginMarkdown(c.Req.Context(), pluginID, name)
	if err != nil {
		var notFound plugins.NotFoundError
		if errors.As(err, &notFound) {
			return response.Error(404, notFound.Error(), nil)
		}

		return response.Error(500, "Could not get markdown file", err)
	}

	// fallback try readme
	if len(content) == 0 {
		content, err = hs.pluginMarkdown(c.Req.Context(), pluginID, "readme")
		if err != nil {
			return response.Error(501, "Could not get markdown file", err)
		}
	}

	resp := response.Respond(http.StatusOK, content)
	resp.SetHeader("Content-Type", "text/plain; charset=utf-8")
	return resp
}

// CollectPluginMetrics collect metrics from a plugin.
//
// /api/plugins/:pluginId/metrics
func (hs *HTTPServer) CollectPluginMetrics(c *models.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]
	resp, err := hs.pluginClient.CollectMetrics(c.Req.Context(), &backend.CollectMetricsRequest{PluginContext: backend.PluginContext{PluginID: pluginID}})
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
	plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), pluginID)
	if !exists {
		c.JsonApiErr(404, "Plugin not found", nil)
		return
	}

	// prepend slash for cleaning relative paths
	requestedFile := filepath.Clean(filepath.Join("/", web.Params(c.Req)["*"]))
	rel, err := filepath.Rel("/", requestedFile)
	if err != nil {
		// slash is prepended above therefore this is not expected to fail
		c.JsonApiErr(500, "Failed to get the relative path", err)
		return
	}

	if !plugin.IncludedInSignature(rel) {
		hs.log.Warn("Access to requested plugin file will be forbidden in upcoming Grafana versions as the file "+
			"is not included in the plugin signature", "file", requestedFile)
	}

	absPluginDir, err := filepath.Abs(plugin.PluginDir)
	if err != nil {
		c.JsonApiErr(500, "Failed to get plugin absolute path", nil)
		return
	}

	pluginFilePath := filepath.Join(absPluginDir, rel)
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

	pCtx, found, err := hs.PluginContextProvider.Get(c.Req.Context(), pluginID, c.SignedInUser)
	if err != nil {
		return response.Error(500, "Failed to get plugin settings", err)
	}
	if !found {
		return response.Error(404, "Plugin not found", nil)
	}

	resp, err := hs.pluginClient.CheckHealth(c.Req.Context(), &backend.CheckHealthRequest{
		PluginContext: pCtx,
		Headers:       map[string]string{},
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

	return response.JSON(http.StatusOK, payload)
}

func (hs *HTTPServer) GetPluginErrorsList(_ *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, hs.pluginErrorResolver.PluginErrors())
}

func (hs *HTTPServer) InstallPlugin(c *models.ReqContext) response.Response {
	dto := dtos.InstallPluginCommand{}
	if err := web.Bind(c.Req, &dto); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	pluginID := web.Params(c.Req)[":pluginId"]

	err := hs.pluginManager.Add(c.Req.Context(), pluginID, dto.Version, plugins.CompatOpts{
		GrafanaVersion: hs.Cfg.BuildVersion,
		OS:             runtime.GOOS,
		Arch:           runtime.GOARCH,
	})
	if err != nil {
		var dupeErr plugins.DuplicateError
		if errors.As(err, &dupeErr) {
			return response.Error(http.StatusConflict, "Plugin already installed", err)
		}
		var versionUnsupportedErr repo.ErrVersionUnsupported
		if errors.As(err, &versionUnsupportedErr) {
			return response.Error(http.StatusConflict, "Plugin version not supported", err)
		}
		var versionNotFoundErr repo.ErrVersionNotFound
		if errors.As(err, &versionNotFoundErr) {
			return response.Error(http.StatusNotFound, "Plugin version not found", err)
		}
		var clientError repo.Response4xxError
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

	err := hs.pluginManager.Remove(c.Req.Context(), pluginID)
	if err != nil {
		if errors.Is(err, plugins.ErrPluginNotInstalled) {
			return response.Error(http.StatusNotFound, "Plugin not installed", err)
		}
		if errors.Is(err, plugins.ErrUninstallCorePlugin) {
			return response.Error(http.StatusForbidden, "Cannot uninstall a Core plugin", err)
		}
		if errors.Is(err, storage.ErrUninstallOutsideOfPluginDir) {
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

func (hs *HTTPServer) pluginMarkdown(ctx context.Context, pluginId string, name string) ([]byte, error) {
	plugin, exists := hs.pluginStore.Plugin(ctx, pluginId)
	if !exists {
		return nil, plugins.NotFoundError{PluginID: pluginId}
	}

	// nolint:gosec
	// We can ignore the gosec G304 warning since we have cleaned the requested file path and subsequently
	// use this with a prefix of the plugin's directory, which is set during plugin loading
	path := filepath.Join(plugin.PluginDir, mdFilepath(strings.ToUpper(name)))
	exists, err := fs.Exists(path)
	if err != nil {
		return nil, err
	}
	if !exists {
		path = filepath.Join(plugin.PluginDir, mdFilepath(strings.ToLower(name)))
	}

	exists, err = fs.Exists(path)
	if err != nil {
		return nil, err
	}
	if !exists {
		return make([]byte, 0), nil
	}

	// nolint:gosec
	// We can ignore the gosec G304 warning since we have cleaned the requested file path and subsequently
	// use this with a prefix of the plugin's directory, which is set during plugin loading
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func mdFilepath(mdFilename string) string {
	return filepath.Clean(filepath.Join("/", fmt.Sprintf("%s.md", mdFilename)))
}

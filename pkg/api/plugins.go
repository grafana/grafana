package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// pluginsCDNFallbackRedirectRequests is a metric counter keeping track of how many
// requests are received on the plugins CDN backend redirect fallback handler.
var pluginsCDNFallbackRedirectRequests = promauto.NewCounterVec(prometheus.CounterOpts{
	Namespace: "grafana",
	Name:      "plugins_cdn_fallback_redirect_requests_total",
	Help:      "Number of requests to the plugins CDN backend redirect fallback handler.",
}, []string{"plugin_id", "plugin_version"})

var ErrUnexpectedFileExtension = errors.New("unexpected file extension")

func (hs *HTTPServer) GetPluginList(c *contextmodel.ReqContext) response.Response {
	typeFilter := c.Query("type")
	enabledFilter := c.Query("enabled")
	embeddedFilter := c.Query("embedded")
	// "" => no filter
	// "0" => filter out core plugins
	// "1" => filter out non-core plugins
	coreFilter := c.Query("core")

	// FIXME: while we don't have permissions for listing plugins we need this complex check:
	// When using access control, should be able to list non-core plugins:
	//  * anyone that can create a data source
	//  * anyone that can install a plugin
	// Fallback to only letting admins list non-core plugins
	reqOrgAdmin := ac.ReqHasRole(org.RoleAdmin)
	hasAccess := ac.HasAccess(hs.AccessControl, c)
	canListNonCorePlugins := reqOrgAdmin(c) || hasAccess(ac.EvalAny(
		ac.EvalPermission(datasources.ActionCreate),
		ac.EvalPermission(pluginaccesscontrol.ActionInstall),
	))

	pluginSettingsMap, err := hs.pluginSettings(c.Req.Context(), c.GetOrgID())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get list of plugins", err)
	}

	// Filter plugins
	pluginDefinitions := hs.pluginStore.Plugins(c.Req.Context())
	filteredPluginDefinitions := make([]pluginstore.Plugin, 0)
	filteredPluginIDs := map[string]bool{}
	for _, pluginDef := range pluginDefinitions {
		// filter out app sub plugins
		if embeddedFilter == "0" && pluginDef.IncludedInAppID != "" {
			continue
		}

		// filter out core plugins
		if (coreFilter == "0" && pluginDef.IsCorePlugin()) || (coreFilter == "1" && !pluginDef.IsCorePlugin()) {
			continue
		}

		// FIXME: while we don't have permissions for listing plugins we need this complex check:
		// When using access control, should be able to list non-core plugins:
		//  * anyone that can create a data source
		//  * anyone that can install a plugin
		// Should be able to list this installed plugin:
		//  * anyone that can edit its settings
		if !pluginDef.IsCorePlugin() && !canListNonCorePlugins && !hasAccess(ac.EvalPermission(pluginaccesscontrol.ActionWrite, pluginaccesscontrol.ScopeProvider.GetResourceScope(pluginDef.ID))) {
			continue
		}

		// filter on type
		if typeFilter != "" && typeFilter != string(pluginDef.Type) {
			continue
		}

		if pluginDef.State == plugins.ReleaseStateAlpha && !hs.Cfg.PluginsEnableAlpha {
			continue
		}

		// filter out built in plugins
		if pluginDef.BuiltIn {
			continue
		}

		// filter out disabled plugins
		if pluginSetting, exists := pluginSettingsMap[pluginDef.ID]; exists {
			if enabledFilter == "1" && !pluginSetting.Enabled {
				continue
			}
		}

		filteredPluginDefinitions = append(filteredPluginDefinitions, pluginDef)
		filteredPluginIDs[pluginDef.ID] = true
	}

	// Compute metadata
	pluginsMetadata := getMultiAccessControlMetadata(c, pluginaccesscontrol.ScopeProvider.GetResourceScope(""), filteredPluginIDs)

	// Prepare DTO
	result := make(dtos.PluginList, 0)
	for _, pluginDef := range filteredPluginDefinitions {
		listItem := dtos.PluginListItem{
			Id:              pluginDef.ID,
			Name:            pluginDef.Name,
			Type:            string(pluginDef.Type),
			Category:        pluginDef.Category,
			Info:            pluginDef.Info,
			Dependencies:    pluginDef.Dependencies,
			DefaultNavUrl:   path.Join(hs.Cfg.AppSubURL, pluginDef.DefaultNavURL),
			State:           pluginDef.State,
			Signature:       pluginDef.Signature,
			SignatureType:   pluginDef.SignatureType,
			SignatureOrg:    pluginDef.SignatureOrg,
			AccessControl:   pluginsMetadata[pluginDef.ID],
			AngularDetected: pluginDef.Angular.Detected,
		}

		if hs.Cfg.ManagedServiceAccountsEnabled && hs.Features.IsEnabled(c.Req.Context(), featuremgmt.FlagExternalServiceAccounts) {
			listItem.IAM = pluginDef.IAM
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

		result = append(result, listItem)
	}

	sort.Sort(result)
	return response.JSON(http.StatusOK, result)
}

func (hs *HTTPServer) GetPluginSettingByID(c *contextmodel.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]

	perr := hs.pluginErrorResolver.PluginError(c.Req.Context(), pluginID)
	if perr != nil {
		return response.Error(http.StatusInternalServerError, perr.PublicMessage(), perr)
	}

	plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), pluginID)
	if !exists {
		return response.Error(http.StatusNotFound, "Plugin not found, no installed plugin with that id", nil)
	}

	// In a first iteration, we only have one permission for app plugins.
	// We will need a different permission to allow users to configure the plugin without needing access to it.
	if plugin.IsApp() {
		hasAccess := ac.HasAccess(hs.AccessControl, c)
		if !hasAccess(ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, pluginaccesscontrol.ScopeProvider.GetResourceScope(plugin.ID))) {
			return response.Error(http.StatusForbidden, "Access Denied", nil)
		}
	}

	dto := &dtos.PluginSetting{
		Type:             string(plugin.Type),
		Id:               plugin.ID,
		Name:             plugin.Name,
		Info:             plugin.Info,
		Dependencies:     plugin.Dependencies,
		Includes:         plugin.Includes,
		BaseUrl:          plugin.BaseURL,
		Module:           plugin.Module,
		ModuleHash:       hs.pluginAssets.ModuleHash(c.Req.Context(), plugin),
		DefaultNavUrl:    path.Join(hs.Cfg.AppSubURL, plugin.DefaultNavURL),
		State:            plugin.State,
		Signature:        plugin.Signature,
		SignatureType:    plugin.SignatureType,
		SignatureOrg:     plugin.SignatureOrg,
		SecureJsonFields: map[string]bool{},
		AngularDetected:  plugin.Angular.Detected,
		LoadingStrategy:  hs.pluginAssets.LoadingStrategy(c.Req.Context(), plugin),
		Extensions:       plugin.Extensions,
	}

	if plugin.IsApp() {
		dto.Enabled = plugin.AutoEnabled
		dto.Pinned = plugin.AutoEnabled
		dto.AutoEnabled = plugin.AutoEnabled
	}

	ps, err := hs.PluginSettings.GetPluginSettingByPluginID(c.Req.Context(), &pluginsettings.GetByPluginIDArgs{
		PluginID: pluginID,
		OrgID:    c.GetOrgID(),
	})
	if err != nil {
		if !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
			return response.Error(http.StatusInternalServerError, "Failed to get plugin settings", nil)
		}
	} else {
		dto.Enabled = ps.Enabled
		dto.Pinned = ps.Pinned
		dto.JsonData = ps.JSONData

		for k, v := range hs.PluginSettings.DecryptedValues(ps) {
			if len(v) > 0 {
				dto.SecureJsonFields[k] = true
			}
		}
	}

	update, exists := hs.pluginsUpdateChecker.HasUpdate(c.Req.Context(), plugin.ID)
	if exists {
		dto.LatestVersion = update
		dto.HasUpdate = true
	}

	return response.JSON(http.StatusOK, dto)
}

func (hs *HTTPServer) UpdatePluginSetting(c *contextmodel.ReqContext) response.Response {
	cmd := pluginsettings.UpdatePluginSettingCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	pluginID := web.Params(c.Req)[":pluginId"]

	p, exists := hs.pluginStore.Plugin(c.Req.Context(), pluginID)
	if !exists {
		return response.Error(http.StatusNotFound, "Plugin not installed", nil)
	}
	if p.AutoEnabled && !cmd.Enabled {
		return response.Error(http.StatusBadRequest, "Cannot disable auto-enabled plugin", nil)
	}

	cmd.OrgId = c.GetOrgID()
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
		return response.Error(http.StatusInternalServerError, "Failed to update plugin setting", err)
	}

	hs.pluginContextProvider.InvalidateSettingsCache(c.Req.Context(), pluginID)

	return response.Success("Plugin settings updated")
}

func (hs *HTTPServer) GetPluginMarkdown(c *contextmodel.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]
	name := web.Params(c.Req)[":name"]

	p, exists := hs.pluginStore.Plugin(c.Req.Context(), pluginID)
	if !exists {
		return response.Error(http.StatusNotFound, "Plugin not installed", nil)
	}

	content, err := hs.pluginMarkdown(c.Req.Context(), pluginID, p.Info.Version, name)
	if err != nil {
		var notFound plugins.NotFoundError
		if errors.As(err, &notFound) {
			return response.Error(http.StatusNotFound, notFound.Error(), nil)
		}

		return response.Error(http.StatusInternalServerError, "Could not get markdown file", err)
	}

	// fallback try readme
	if len(content) == 0 {
		content, err = hs.pluginMarkdown(c.Req.Context(), pluginID, p.Info.Version, "readme")
		if err != nil {
			if errors.Is(err, plugins.ErrFileNotExist) {
				return response.Error(http.StatusNotFound, plugins.ErrFileNotExist.Error(), nil)
			}
			return response.Error(http.StatusNotImplemented, "Could not get markdown file", err)
		}
	}

	resp := response.Respond(http.StatusOK, content)
	resp.SetHeader("Content-Type", "text/plain; charset=utf-8")
	return resp
}

// CollectPluginMetrics collect metrics from a plugin.
//
// /api/plugins/:pluginId/metrics
func (hs *HTTPServer) CollectPluginMetrics(c *contextmodel.ReqContext) response.Response {
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
// If the plugin has cdn = false in its config (default), it will always attempt to return the asset
// from the local filesystem.
//
// If the plugin has cdn = true and hs.Cfg.PluginsCDNURLTemplate is empty, it will get the file
// from the local filesystem. If hs.Cfg.PluginsCDNURLTemplate is not empty,
// this handler returns a redirect to the plugin asset file on the specified CDN.
//
// /public/plugins/:pluginId/*
func (hs *HTTPServer) getPluginAssets(c *contextmodel.ReqContext) {
	pluginID := web.Params(c.Req)[":pluginId"]
	plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), pluginID)
	if !exists {
		c.JsonApiErr(404, "Plugin not found", nil)
		return
	}

	// prepend slash for cleaning relative paths
	requestedFile, err := util.CleanRelativePath(web.Params(c.Req)["*"])
	if err != nil {
		// slash is prepended above therefore this is not expected to fail
		c.JsonApiErr(500, "Failed to clean relative file path", err)
		return
	}

	if hs.pluginsCDNService.PluginSupported(pluginID) {
		// Send a redirect to the client
		hs.redirectCDNPluginAsset(c, plugin, requestedFile)
		return
	}

	// Send the actual file to the client from local filesystem
	hs.serveLocalPluginAsset(c, plugin, requestedFile)
}

// serveLocalPluginAsset returns the content of a plugin asset file from the local filesystem to the http client.
func (hs *HTTPServer) serveLocalPluginAsset(c *contextmodel.ReqContext, plugin pluginstore.Plugin, assetPath string) {
	f, err := hs.pluginFileStore.File(c.Req.Context(), plugin.ID, plugin.Info.Version, assetPath)
	if err != nil {
		if errors.Is(err, plugins.ErrFileNotExist) {
			c.JsonApiErr(404, "Plugin file not found", nil)
			return
		}
		c.JsonApiErr(500, "Could not open plugin file", err)
		return
	}

	if hs.Cfg.Env == setting.Dev {
		c.Resp.Header().Set("Cache-Control", "max-age=0, must-revalidate, no-cache")
	} else {
		c.Resp.Header().Set("Cache-Control", "public, max-age=3600")
	}

	http.ServeContent(c.Resp, c.Req, assetPath, f.ModTime, bytes.NewReader(f.Content))
}

// redirectCDNPluginAsset redirects the http request to specified asset path on the configured plugins CDN.
func (hs *HTTPServer) redirectCDNPluginAsset(c *contextmodel.ReqContext, plugin pluginstore.Plugin, assetPath string) {
	remoteURL, err := hs.pluginsCDNService.AssetURL(plugin.ID, plugin.Info.Version, assetPath)
	if err != nil {
		c.JsonApiErr(500, "Failed to get CDN plugin asset remote URL", err)
		return
	}
	hs.log.Warn(
		"plugin cdn redirect hit",
		"pluginID", plugin.ID,
		"pluginVersion", plugin.Info.Version,
		"assetPath", assetPath,
		"remoteURL", remoteURL,
		"referer", c.Req.Referer(),
		"user", c.Login,
	)
	pluginsCDNFallbackRedirectRequests.With(prometheus.Labels{
		"plugin_id":      plugin.ID,
		"plugin_version": plugin.Info.Version,
	}).Inc()
	http.Redirect(c.Resp, c.Req, remoteURL, http.StatusTemporaryRedirect)
}

// CheckHealth returns the health of a plugin.
// /api/plugins/:pluginId/health
func (hs *HTTPServer) CheckHealth(c *contextmodel.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]
	pCtx, err := hs.pluginContextProvider.Get(c.Req.Context(), pluginID, c.SignedInUser, c.GetOrgID())
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to get plugin settings", err)
	}
	resp, err := hs.pluginClient.CheckHealth(c.Req.Context(), &backend.CheckHealthRequest{
		PluginContext: pCtx,
		Headers:       map[string]string{},
	})
	if err != nil {
		return translatePluginRequestErrorToAPIError(err)
	}

	payload := map[string]any{
		"status":  resp.Status.String(),
		"message": resp.Message,
	}

	// Unmarshal JSONDetails if it's not empty.
	if len(resp.JSONDetails) > 0 {
		var jsonDetails map[string]any
		err = json.Unmarshal(resp.JSONDetails, &jsonDetails)
		if err != nil {
			return response.Error(http.StatusInternalServerError, "Failed to unmarshal detailed response from backend plugin", err)
		}

		payload["details"] = jsonDetails
	}

	if resp.Status != backend.HealthStatusOk {
		return response.JSON(http.StatusBadRequest, payload)
	}

	return response.JSON(http.StatusOK, payload)
}

func (hs *HTTPServer) GetPluginErrorsList(c *contextmodel.ReqContext) response.Response {
	return response.JSON(http.StatusOK, hs.pluginErrorResolver.PluginErrors(c.Req.Context()))
}

func (hs *HTTPServer) InstallPlugin(c *contextmodel.ReqContext) response.Response {
	dto := dtos.InstallPluginCommand{}
	if err := web.Bind(c.Req, &dto); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	pluginID := web.Params(c.Req)[":pluginId"]

	hs.log.Info("Plugin install/update requested", "pluginId", pluginID, "user", c.Login)

	for hs.pluginPreinstall.IsPinned(pluginID) {
		return response.Error(http.StatusConflict, "Cannot update a pinned pre-installed plugin", nil)
	}

	compatOpts := plugins.NewAddOpts(hs.Cfg.BuildVersion, runtime.GOOS, runtime.GOARCH, "")
	ctx := repo.WithRequestOrigin(c.Req.Context(), "api")
	err := hs.pluginInstaller.Add(ctx, pluginID, dto.Version, compatOpts)
	if err != nil {
		var dupeErr plugins.DuplicateError
		if errors.As(err, &dupeErr) {
			return response.Error(http.StatusConflict, "Plugin already installed", err)
		}
		var clientError repo.ErrResponse4xx
		if errors.As(err, &clientError) {
			return response.Error(clientError.StatusCode(), clientError.Message(), err)
		}
		if errors.Is(err, plugins.ErrInstallCorePlugin) {
			return response.Error(http.StatusForbidden, "Cannot install or change a Core plugin", err)
		}

		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to install plugin", err)
	}

	if hs.Cfg.ManagedServiceAccountsEnabled && hs.Features.IsEnabled(c.Req.Context(), featuremgmt.FlagExternalServiceAccounts) {
		// This is a non-blocking function that verifies that the installer has
		// the permissions that the plugin requests to have on Grafana.
		// If we want to make this blocking, the check will have to happen before or during the installation.
		hs.hasPluginRequestedPermissions(c, pluginID)
	}

	return response.JSON(http.StatusOK, []byte{})
}

func (hs *HTTPServer) UninstallPlugin(c *contextmodel.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]

	hs.log.Info("Plugin uninstall requested", "pluginId", pluginID, "user", c.Login)

	plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), pluginID)
	if !exists {
		return response.Error(http.StatusNotFound, "Plugin not installed", nil)
	}

	for hs.pluginPreinstall.IsPreinstalled(pluginID) {
		return response.Error(http.StatusConflict, "Cannot uninstall a pre-installed plugin", nil)
	}

	err := hs.pluginInstaller.Remove(c.Req.Context(), pluginID, plugin.Info.Version)
	if err != nil {
		if errors.Is(err, plugins.ErrPluginNotInstalled) {
			return response.Error(http.StatusNotFound, "Plugin not installed", err)
		}
		if errors.Is(err, plugins.ErrUninstallCorePlugin) {
			return response.Error(http.StatusForbidden, "Cannot uninstall a Core plugin", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to uninstall plugin", err)
	}
	return response.JSON(http.StatusOK, []byte{})
}

func translatePluginRequestErrorToAPIError(err error) response.Response {
	return response.ErrOrFallback(http.StatusInternalServerError, "Plugin request failed", err)
}

func (hs *HTTPServer) pluginMarkdown(ctx context.Context, pluginID, pluginVersion, name string) ([]byte, error) {
	file, err := mdFilepath(strings.ToUpper(name))
	if err != nil {
		return make([]byte, 0), err
	}

	md, err := hs.pluginFileStore.File(ctx, pluginID, pluginVersion, file)
	if err != nil {
		if errors.Is(err, plugins.ErrPluginNotInstalled) {
			return make([]byte, 0), plugins.NotFoundError{PluginID: pluginID}
		}

		md, err = hs.pluginFileStore.File(ctx, pluginID, pluginVersion, strings.ToLower(file))
		if err != nil {
			return make([]byte, 0), nil
		}
	}
	return md.Content, nil
}

// hasPluginRequestedPermissions logs if the plugin installer does not have the permissions that the plugin requests to have on Grafana.
func (hs *HTTPServer) hasPluginRequestedPermissions(c *contextmodel.ReqContext, pluginID string) {
	plugin, ok := hs.pluginStore.Plugin(c.Req.Context(), pluginID)
	if !ok {
		hs.log.Debug("plugin has not been installed", "pluginID", pluginID)
		return
	}

	// No registration => Early return
	if plugin.IAM == nil || len(plugin.IAM.Permissions) == 0 {
		hs.log.Debug("plugin did not request permissions on Grafana", "pluginID", pluginID)
		return
	}

	hs.log.Debug("check installer's permissions, plugin wants to register an external service")
	evaluator := evalAllPermissions(plugin.IAM.Permissions)
	hasAccess := ac.HasGlobalAccess(hs.AccessControl, hs.authnService, c)
	if hs.Cfg.RBAC.SingleOrganization {
		// In a single organization setup, no need for a global check
		hasAccess = ac.HasAccess(hs.AccessControl, c)
	}

	// Log a warning if the user does not have the plugin requested permissions
	if !hasAccess(evaluator) {
		hs.log.Warn("Plugin installer has less permission than what the plugin requires.", "Permissions", evaluator.String())
	}
}

// evalAllPermissions generates an evaluator with all permissions from the input slice
func evalAllPermissions(ps []auth.Permission) ac.Evaluator {
	res := make([]ac.Evaluator, len(ps))
	for i, p := range ps {
		if p.Scope != "" {
			res[i] = ac.EvalPermission(p.Action, p.Scope)
			continue
		}
		res[i] = ac.EvalPermission(p.Action)
	}
	return ac.EvalAll(res...)
}

func mdFilepath(mdFilename string) (string, error) {
	fileExt := filepath.Ext(mdFilename)
	switch fileExt {
	case "md":
		return util.CleanRelativePath(mdFilename)
	case "":
		return util.CleanRelativePath(fmt.Sprintf("%s.md", mdFilename))
	default:
		return "", ErrUnexpectedFileExtension
	}
}

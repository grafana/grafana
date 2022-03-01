package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/installer"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/util/proxyutil"
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
	return response.JSON(200, result)
}

func (hs *HTTPServer) GetPluginSettingByID(c *models.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]

	plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), pluginID)
	if !exists {
		return response.Error(404, "Plugin not found, no installed plugin with that id", nil)
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

	query := models.GetPluginSettingByIdQuery{PluginId: pluginID, OrgId: c.OrgId}
	if err := hs.PluginSettings.GetPluginSettingById(c.Req.Context(), &query); err != nil {
		if !errors.Is(err, models.ErrPluginSettingNotFound) {
			return response.Error(500, "Failed to get login settings", nil)
		}
	} else {
		dto.Enabled = query.Result.Enabled
		dto.Pinned = query.Result.Pinned
		dto.JsonData = query.Result.JsonData
	}

	update, exists := hs.pluginsUpdateChecker.HasUpdate(c.Req.Context(), plugin.ID)
	if exists {
		dto.LatestVersion = update
		dto.HasUpdate = true
	}

	return response.JSON(200, dto)
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

	cmd.OrgId = c.OrgId
	cmd.PluginId = pluginID
	if err := hs.PluginSettings.UpdatePluginSetting(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to update plugin setting", err)
	}

	return response.Success("Plugin settings updated")
}

func (hs *HTTPServer) GetPluginDashboards(c *models.ReqContext) response.Response {
	pluginID := web.Params(c.Req)[":pluginId"]

	list, err := hs.pluginDashboardManager.GetPluginDashboards(c.Req.Context(), c.OrgId, pluginID)
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

	resp := response.Respond(200, content)
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
	hs.callPluginResource(c, web.Params(c.Req)[":pluginId"], "")
}

func (hs *HTTPServer) GetPluginErrorsList(_ *models.ReqContext) response.Response {
	return response.JSON(200, hs.pluginErrorResolver.PluginErrors())
}

func (hs *HTTPServer) InstallPlugin(c *models.ReqContext) response.Response {
	dto := dtos.InstallPluginCommand{}
	if err := web.Bind(c.Req, &dto); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	pluginID := web.Params(c.Req)[":pluginId"]

	err := hs.pluginStore.Add(c.Req.Context(), pluginID, dto.Version)
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
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func mdFilepath(mdFilename string) string {
	return filepath.Clean(filepath.Join("/", fmt.Sprintf("%s.md", mdFilename)))
}

func (hs *HTTPServer) callPluginResource(c *models.ReqContext, pluginID, dsUID string) {
	pCtx, found, err := hs.PluginContextProvider.Get(c.Req.Context(), pluginID, dsUID, c.SignedInUser, false)
	if err != nil {
		c.JsonApiErr(500, "Failed to get plugin settings", err)
		return
	}
	if !found {
		c.JsonApiErr(404, "Plugin not found", nil)
		return
	}

	var dsURL string
	if pCtx.DataSourceInstanceSettings != nil {
		dsURL = pCtx.DataSourceInstanceSettings.URL
	}

	err = hs.PluginRequestValidator.Validate(dsURL, c.Req)
	if err != nil {
		c.JsonApiErr(http.StatusForbidden, "Access denied", err)
		return
	}

	clonedReq := c.Req.Clone(c.Req.Context())
	rawURL := web.Params(c.Req)["*"]
	if clonedReq.URL.RawQuery != "" {
		rawURL += "?" + clonedReq.URL.RawQuery
	}
	urlPath, err := url.Parse(rawURL)
	if err != nil {
		handleCallResourceError(err, c)
		return
	}
	clonedReq.URL = urlPath

	if err = hs.makePluginResourceRequest(c.Resp, clonedReq, pCtx); err != nil {
		handleCallResourceError(err, c)
	}
}

func (hs *HTTPServer) makePluginResourceRequest(w http.ResponseWriter, req *http.Request, pCtx backend.PluginContext) error {
	keepCookieModel := struct {
		KeepCookies []string `json:"keepCookies"`
	}{}
	if dis := pCtx.DataSourceInstanceSettings; dis != nil {
		err := json.Unmarshal(dis.JSONData, &keepCookieModel)
		if err != nil {
			hs.log.Warn("failed to to unpack JSONData in datasource instance settings", "err", err)
		}
	}
	proxyutil.ClearCookieHeader(req, keepCookieModel.KeepCookies)
	proxyutil.PrepareProxyRequest(req)

	body, err := ioutil.ReadAll(req.Body)
	if err != nil {
		return fmt.Errorf("failed to read request body: %w", err)
	}

	crReq := &backend.CallResourceRequest{
		PluginContext: pCtx,
		Path:          req.URL.Path,
		Method:        req.Method,
		URL:           req.URL.String(),
		Headers:       req.Header,
		Body:          body,
	}

	childCtx, cancel := context.WithCancel(req.Context())
	defer cancel()
	stream := newCallResourceResponseStream(childCtx)

	var wg sync.WaitGroup
	wg.Add(1)

	defer func() {
		if err := stream.Close(); err != nil {
			hs.log.Warn("Failed to close plugin resource stream", "err", err)
		}
		wg.Wait()
	}()

	var flushStreamErr error
	go func() {
		flushStreamErr = hs.flushStream(stream, w)
		wg.Done()
	}()

	if err := hs.pluginClient.CallResource(req.Context(), crReq, stream); err != nil {
		return err
	}

	return flushStreamErr
}

func (hs *HTTPServer) flushStream(stream callResourceClientResponseStream, w http.ResponseWriter) error {
	processedStreams := 0

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			if processedStreams == 0 {
				return errors.New("received empty resource response")
			}
			return nil
		}
		if err != nil {
			if processedStreams == 0 {
				return errutil.Wrap("failed to receive response from resource call", err)
			}

			hs.log.Error("Failed to receive response from resource call", "err", err)
			return stream.Close()
		}

		// Expected that headers and status are only part of first stream
		if processedStreams == 0 && resp.Headers != nil {
			// Make sure a content type always is returned in response
			if _, exists := resp.Headers["Content-Type"]; !exists {
				resp.Headers["Content-Type"] = []string{"application/json"}
			}

			for k, values := range resp.Headers {
				// Due to security reasons we don't want to forward
				// cookies from a backend plugin to clients/browsers.
				if k == "Set-Cookie" {
					continue
				}

				for _, v := range values {
					// TODO: Figure out if we should use Set here instead
					// nolint:gocritic
					w.Header().Add(k, v)
				}
			}

			proxyutil.SetProxyResponseHeaders(w.Header())

			w.WriteHeader(resp.Status)
		}

		if _, err := w.Write(resp.Body); err != nil {
			hs.log.Error("Failed to write resource response", "err", err)
		}

		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
		processedStreams++
	}
}

func handleCallResourceError(err error, reqCtx *models.ReqContext) {
	if errors.Is(err, backendplugin.ErrPluginUnavailable) {
		reqCtx.JsonApiErr(503, "Plugin unavailable", err)
		return
	}

	if errors.Is(err, backendplugin.ErrMethodNotImplemented) {
		reqCtx.JsonApiErr(404, "Not found", err)
		return
	}

	reqCtx.JsonApiErr(500, "Failed to call resource", err)
}

// callResourceClientResponseStream is used for receiving resource call responses.
type callResourceClientResponseStream interface {
	Recv() (*backend.CallResourceResponse, error)
	Close() error
}

type callResourceResponseStream struct {
	ctx    context.Context
	stream chan *backend.CallResourceResponse
	closed bool
}

func newCallResourceResponseStream(ctx context.Context) *callResourceResponseStream {
	return &callResourceResponseStream{
		ctx:    ctx,
		stream: make(chan *backend.CallResourceResponse),
	}
}

func (s *callResourceResponseStream) Send(res *backend.CallResourceResponse) error {
	if s.closed {
		return errors.New("cannot send to a closed stream")
	}

	select {
	case <-s.ctx.Done():
		return errors.New("cancelled")
	case s.stream <- res:
		return nil
	}
}

func (s *callResourceResponseStream) Recv() (*backend.CallResourceResponse, error) {
	select {
	case <-s.ctx.Done():
		return nil, s.ctx.Err()
	case res, ok := <-s.stream:
		if !ok {
			return nil, io.EOF
		}
		return res, nil
	}
}

func (s *callResourceResponseStream) Close() error {
	if s.closed {
		return errors.New("cannot close a closed stream")
	}

	close(s.stream)
	s.closed = true
	return nil
}

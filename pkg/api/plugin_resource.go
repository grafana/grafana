package api

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/grafana/grafana/pkg/web"
)

// CallResource passes a resource call from a plugin to the backend plugin.
//
// /api/plugins/:pluginId/resources/*
func (hs *HTTPServer) CallResource(c *contextmodel.ReqContext) {
	hs.callPluginResource(c, web.Params(c.Req)[":pluginId"])
}

func (hs *HTTPServer) callPluginResource(c *contextmodel.ReqContext, pluginID string) {
	pCtx, err := hs.pluginContextProvider.Get(c.Req.Context(), pluginID, c.SignedInUser, c.GetOrgID())
	if err != nil {
		if errors.Is(err, plugins.ErrPluginNotRegistered) {
			c.JsonApiErr(404, "Plugin not found", nil)
			return
		}
		c.JsonApiErr(500, "Failed to get plugin settings", err)
		return
	}

	req, err := hs.pluginResourceRequest(c)
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "Failed for create plugin resource request", err)
		return
	}

	if err = hs.makePluginResourceRequest(c.Resp, req, pCtx); err != nil {
		handleCallResourceError(err, c)
		return
	}

	requestmeta.WithStatusSource(c.Req.Context(), c.Resp.Status())
}

func (hs *HTTPServer) callPluginResourceWithDataSource(c *contextmodel.ReqContext, pluginID string, ds *datasources.DataSource) {
	pCtx, err := hs.pluginContextProvider.GetWithDataSource(c.Req.Context(), pluginID, c.SignedInUser, ds)
	if err != nil {
		if errors.Is(err, plugins.ErrPluginNotRegistered) {
			c.JsonApiErr(404, "Plugin not found", nil)
			return
		}
		c.JsonApiErr(500, "Failed to get plugin settings", err)
		return
	}

	err = hs.DataSourceRequestValidator.Validate(ds, c.Req)
	if err != nil {
		c.JsonApiErr(http.StatusForbidden, "Access denied", err)
		return
	}

	req, err := hs.pluginResourceRequest(c)
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "Failed for create plugin resource request", err)
		return
	}

	if err = hs.makePluginResourceRequest(c.Resp, req, pCtx); err != nil {
		handleCallResourceError(err, c)
		return
	}

	requestmeta.WithStatusSource(c.Req.Context(), c.Resp.Status())
}

func (hs *HTTPServer) pluginResourceRequest(c *contextmodel.ReqContext) (*http.Request, error) {
	clonedReq := c.Req.Clone(c.Req.Context())
	rawURL := web.Params(c.Req)["*"]

	clonedReq.URL = &url.URL{
		Path:     rawURL,
		RawQuery: clonedReq.URL.RawQuery,
	}

	return clonedReq, nil
}

func (hs *HTTPServer) makePluginResourceRequest(w http.ResponseWriter, req *http.Request, pCtx backend.PluginContext) error {
	proxyutil.PrepareProxyRequest(req)

	body, err := io.ReadAll(req.Body)
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

	httpSender := httpresponsesender.New(w)
	return hs.pluginClient.CallResource(req.Context(), crReq, httpSender)
}

func handleCallResourceError(err error, reqCtx *contextmodel.ReqContext) {
	resp := response.ErrOrFallback(http.StatusInternalServerError, "Failed to call resource", err)
	resp.WriteTo(reqCtx)
}

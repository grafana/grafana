package api

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"

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

	if err := validateResourceMethod(c.Req.Method); err != nil {
		handleCallResourceError(err, c)
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

	err = hs.DataSourceRequestValidator.Validate(ds.URL, ds.JsonData, c.Req)
	if err != nil {
		c.JsonApiErr(http.StatusForbidden, "Access denied", err)
		return
	}

	if err := validateResourceMethod(c.Req.Method); err != nil {
		handleCallResourceError(err, c)
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

// allowedResourceMethods defines the HTTP methods supported for datasource resource calls.
var allowedResourceMethods = map[string]bool{
	http.MethodGet:    true,
	http.MethodPost:   true,
	http.MethodPut:    true,
	http.MethodDelete: true,
	http.MethodPatch:  true,
}

// allowedResourceMethodsList returns a sorted, comma-separated list of allowed HTTP methods
// for use in the Allow response header.
func allowedResourceMethodsList() string {
	methods := make([]string, 0, len(allowedResourceMethods))
	for m := range allowedResourceMethods {
		methods = append(methods, m)
	}
	sort.Strings(methods)
	return strings.Join(methods, ", ")
}

// validateResourceMethod checks if the HTTP method is allowed for plugin resource calls.
// Returns nil if the method is allowed, or an error if the method is not supported.
func validateResourceMethod(method string) error {
	if !allowedResourceMethods[method] {
		return plugins.ErrPluginMethodNotAllowed
	}
	return nil
}

func handleCallResourceError(err error, reqCtx *contextmodel.ReqContext) {
	if errors.Is(err, plugins.ErrPluginMethodNotAllowed) {
		reqCtx.Resp.Header().Set("Allow", allowedResourceMethodsList())
		resp := response.ErrOrFallback(http.StatusMethodNotAllowed, "Method not allowed", err)
		resp.WriteTo(reqCtx)
		return
	}
	resp := response.ErrOrFallback(http.StatusInternalServerError, "Failed to call resource", err)
	resp.WriteTo(reqCtx)
}

package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginclient"
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
	if err := hs.makePluginResourceRequest(c.Resp, c.Req, pluginclient.AppRef(pluginID)); err != nil {
		handleCallResourceError(err, c)
		return
	}

	requestmeta.WithStatusSource(c.Req.Context(), c.Resp.Status())
}

func (hs *HTTPServer) makePluginResourceRequest(w http.ResponseWriter, req *http.Request, ref pluginclient.PluginReference) error {
	clientReq, err := pluginclient.CallResourceRequestFromHTTPRequest(ref, req)
	if err != nil {
		return err
	}

	proxyutil.PrepareProxyRequest(req)

	httpSender := httpresponsesender.New(w)
	return hs.pluginFacade.CallResource(req.Context(), clientReq, httpSender)
}

func handleCallResourceError(err error, reqCtx *contextmodel.ReqContext) {
	resp := response.ErrOrFallback(http.StatusInternalServerError, "Failed to call resource", err)
	resp.WriteTo(reqCtx)
}

package api

import (
	"fmt"
	"net/http"

	"github.com/open-feature/go-sdk/openfeature"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/web"
)

const (
	appPluginAPIVersion  = "v0alpha1"
	appPluginInstance    = "instance"
	appPluginAPIBasePath = "/apis/%s/" + appPluginAPIVersion + "/namespaces/%s/app/" + appPluginInstance
)

// callK8sAppPluginResourceHandler returns a handler that redirects
// /api/plugins/:pluginId/resources[/*] to
// /apis/<pluginId>/v0alpha1/namespaces/<ns>/app/instance/resources[/*]
// when plugins.useMTPluginBackend is enabled.
func (hs *HTTPServer) callK8sAppPluginResourceHandler() web.Handler {
	return func(c *contextmodel.ReqContext) {
		if !hs.appPluginRedirectEnabled(c) {
			hs.pluginEndpointRedirects.WithLabelValues("resources", "legacy").Inc()
			hs.CallResource(c)
			return
		}

		pluginID := web.Params(c.Req)[":pluginId"]
		if pluginID == "" {
			c.JsonApiErr(http.StatusBadRequest, "pluginId is required", nil)
			return
		}

		namespace := hs.namespacer(c.GetOrgID())
		subPath := web.Params(c.Req)["*"]

		k8sPath := fmt.Sprintf(appPluginAPIBasePath+"/resources", pluginID, namespace)
		if subPath != "" {
			k8sPath += "/" + subPath
		}

		c.Req.URL.Path = k8sPath
		hs.pluginEndpointRedirects.WithLabelValues("resources", "remote").Inc()
		hs.clientConfigProvider.DirectlyServeHTTP(c.Resp, c.Req)
	}
}

// callK8sAppPluginHealthHandler returns a handler that redirects
// GET /api/plugins/:pluginId/health to
// /apis/<pluginId>/v0alpha1/namespaces/<ns>/app/instance/health
// when plugins.useMTPluginBackend is enabled.
func (hs *HTTPServer) callK8sAppPluginHealthHandler() web.Handler {
	return func(c *contextmodel.ReqContext) {
		if !hs.appPluginRedirectEnabled(c) {
			hs.pluginEndpointRedirects.WithLabelValues("health", "legacy").Inc()
			hs.CheckHealth(c).WriteTo(c)
			return
		}

		pluginID := web.Params(c.Req)[":pluginId"]
		if pluginID == "" {
			c.JsonApiErr(http.StatusBadRequest, "pluginId is required", nil)
			return
		}

		namespace := hs.namespacer(c.GetOrgID())
		c.Req.URL.Path = fmt.Sprintf(appPluginAPIBasePath+"/health", pluginID, namespace)
		hs.pluginEndpointRedirects.WithLabelValues("health", "remote").Inc()
		hs.clientConfigProvider.DirectlyServeHTTP(c.Resp, c.Req)
	}
}

// callK8sAppPluginProxyHandler returns a handler that redirects
// /api/plugin-proxy/:pluginId[/*] to
// /apis/<pluginId>/v0alpha1/namespaces/<ns>/app/instance/proxy[/*]
// when plugins.useMTPluginBackend is enabled.
func (hs *HTTPServer) callK8sAppPluginProxyHandler() web.Handler {
	return func(c *contextmodel.ReqContext) {
		if !hs.appPluginRedirectEnabled(c) {
			hs.pluginEndpointRedirects.WithLabelValues("proxy", "legacy").Inc()
			hs.ProxyPluginRequest(c)
			return
		}

		pluginID := web.Params(c.Req)[":pluginId"]
		if pluginID == "" {
			c.JsonApiErr(http.StatusBadRequest, "pluginId is required", nil)
			return
		}

		namespace := hs.namespacer(c.GetOrgID())
		subPath := web.Params(c.Req)["*"]

		k8sPath := fmt.Sprintf(appPluginAPIBasePath+"/proxy", pluginID, namespace)
		if subPath != "" {
			k8sPath += "/" + subPath
		}

		c.Req.URL.Path = k8sPath
		hs.pluginEndpointRedirects.WithLabelValues("proxy", "remote").Inc()
		hs.clientConfigProvider.DirectlyServeHTTP(c.Resp, c.Req)
	}
}

func (hs *HTTPServer) appPluginRedirectEnabled(c *contextmodel.ReqContext) bool {
	enabled, _ := openfeature.NewDefaultClient().BooleanValue(
		c.Req.Context(),
		featuremgmt.FlagPluginsUseMTPluginBackend,
		false,
		openfeature.TransactionContext(c.Req.Context()),
	)
	return enabled
}

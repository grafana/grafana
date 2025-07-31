package api

import (
	"crypto/tls"
	"net"
	"net/http"
	"regexp"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/web"
)

var (
	once                 sync.Once
	pluginProxyTransport *http.Transport
)

func (hs *HTTPServer) ProxyPluginRequest(c *contextmodel.ReqContext) {
	once.Do(func() {
		cfg := hs.Cfg.Get()
		pluginProxyTransport = &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: cfg.PluginsAppsSkipVerifyTLS,
				Renegotiation:      tls.RenegotiateFreelyAsClient,
			},
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			TLSHandshakeTimeout: 10 * time.Second,
		}
	})

	pluginID := web.Params(c.Req)[":pluginId"]

	plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), pluginID)
	if !exists {
		c.JsonApiErr(http.StatusNotFound, "Plugin not found, no installed plugin with that id", nil)
		return
	}

	query := pluginsettings.GetByPluginIDArgs{OrgID: c.GetOrgID(), PluginID: plugin.ID}
	ps, err := hs.PluginSettings.GetPluginSettingByPluginID(c.Req.Context(), &query)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Failed to fetch plugin settings", err)
		return
	}

	proxyPath := getProxyPath(c)
	p, err := pluginproxy.NewPluginProxy(ps, plugin.Routes, c, proxyPath, hs.Cfg, hs.SecretsService, hs.tracer, pluginProxyTransport, hs.AccessControl, hs.Features)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Failed to create plugin proxy", err)
		return
	}

	p.HandleRequest()
}

var pluginProxyPathRegexp = regexp.MustCompile(`^\/api\/plugin-proxy\/([\w\-]+)\/?`)

func extractProxyPath(originalRawPath string) string {
	return pluginProxyPathRegexp.ReplaceAllString(originalRawPath, "")
}

func getProxyPath(c *contextmodel.ReqContext) string {
	return extractProxyPath(c.Req.URL.EscapedPath())
}

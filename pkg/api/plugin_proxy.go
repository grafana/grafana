package api

import (
	"crypto/tls"
	"net"
	"net/http"
	"regexp"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) ProxyPluginRequest(c *models.ReqContext) {
	var once sync.Once
	var pluginProxyTransport *http.Transport
	once.Do(func() {
		pluginProxyTransport = &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: hs.Cfg.PluginsAppsSkipVerifyTLS,
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

	query := pluginsettings.GetByPluginIDArgs{OrgID: c.OrgID, PluginID: plugin.ID}
	ps, err := hs.PluginSettings.GetPluginSettingByPluginID(c.Req.Context(), &query)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Failed to fetch plugin settings", err)
		return
	}

	proxyPath := getProxyPath(c)
	p, err := pluginproxy.NewPluginProxy(ps, plugin.Routes, c, proxyPath, hs.Cfg, hs.SecretsService, hs.tracer, pluginProxyTransport)
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

func getProxyPath(c *models.ReqContext) string {
	return extractProxyPath(c.Req.URL.EscapedPath())
}

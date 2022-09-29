package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/grafana/grafana/pkg/web"
)

var grafanaComProxyTransport = &http.Transport{
	Proxy: http.ProxyFromEnvironment,
	DialContext: (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext,
	TLSHandshakeTimeout: 10 * time.Second,
}

func (hs *HTTPServer) ListGnetPlugins(c *models.ReqContext) {
	proxy := ReverseProxyGnetReq(c.Logger, "/plugins", hs.Cfg.BuildVersion)
	proxy.Transport = grafanaComProxyTransport
	director := proxy.Director
	proxy.Director = func(r *http.Request) {
		// Call director set with ReverseProxyGnetReq
		director(r)
		// Request no encoding to simplify modifying the response
		r.Header.Set("Accept-Encoding", "")
	}
	writeResponse := func(r *http.Response, b []byte) {
		r.Body = io.NopCloser(bytes.NewReader(b))
		r.ContentLength = int64(len(b))
		r.Header.Set("Content-Length", strconv.Itoa(len(b)))
	}
	proxy.ModifyResponse = func(r *http.Response) error {
		// Early return
		if hs.AccessControl.IsDisabled() {
			return nil
		}

		// Read body
		defer r.Body.Close()
		b, errRead := io.ReadAll(r.Body)
		if errRead != nil {
			hs.log.Warn("error reading gnet plugin list", "error", errRead)
			return nil
		}

		pluginList := map[string]interface{}{}
		if errUnmarshal := json.Unmarshal(b, &pluginList); errUnmarshal != nil {
			hs.log.Warn("error parsing gnet plugins list", "error", errUnmarshal)
			writeResponse(r, b)
			return nil
		}

		// Add RBAC Metadata to the plugins list
		ok := hs.addMetadataToGNETPluginList(pluginList, c)
		if !ok {
			hs.log.Warn("could not add metadata to gnet plugins list")
			writeResponse(r, b)
			return nil
		}

		// Return the modified plugins list
		newBody, errMarshal := json.Marshal(pluginList)
		if errMarshal != nil {
			hs.log.Warn("could not marshal modified gnet plugins list", "err", errMarshal)
			writeResponse(r, b)
			return nil
		}

		writeResponse(r, newBody)
		return nil
	}
	proxy.ServeHTTP(c.Resp, c.Req)
}

func (*HTTPServer) addMetadataToGNETPluginList(pluginList map[string]interface{}, c *models.ReqContext) bool {
	items, ok := pluginList["items"].([]interface{})
	if !ok {
		return false
	}

	ids := map[string]bool{}
	for i := range items {
		item, ok := items[i].(map[string]interface{})
		if !ok {
			continue
		}
		if slug, ok := item["slug"]; ok {
			pluginID := slug.(string)
			ids[pluginID] = true
		}
	}

	metadata := ac.GetResourcesMetadata(c.Req.Context(),
		c.SignedInUser.Permissions[c.OrgID],
		plugins.ScopeProvider.GetResourceScope(""),
		ids)

	for i := range items {
		item, ok := items[i].(map[string]interface{})
		if !ok {
			continue
		}
		if slug, ok := item["slug"]; ok {
			pluginID := slug.(string)
			item["accessControl"] = metadata[pluginID]
		}
		items[i] = item
	}

	pluginList["items"] = items
	return true
}

func ReverseProxyGnetReq(logger log.Logger, proxyPath string, version string) *httputil.ReverseProxy {
	url, _ := url.Parse(setting.GrafanaComUrl)

	director := func(req *http.Request) {
		req.URL.Scheme = url.Scheme
		req.URL.Host = url.Host
		req.Host = url.Host

		req.URL.Path = util.JoinURLFragments(url.Path+"/api", proxyPath)

		// clear cookie headers
		req.Header.Del("Cookie")
		req.Header.Del("Set-Cookie")
		req.Header.Del("Authorization")

		// send the current Grafana version for each request proxied to GCOM
		req.Header.Add("grafana-version", version)
	}

	return proxyutil.NewReverseProxy(logger, director)
}

func (hs *HTTPServer) ProxyGnetRequest(c *models.ReqContext) {
	proxyPath := web.Params(c.Req)["*"]
	proxy := ReverseProxyGnetReq(c.Logger, proxyPath, hs.Cfg.BuildVersion)
	proxy.Transport = grafanaComProxyTransport
	proxy.ServeHTTP(c.Resp, c.Req)
}

package api

import (
	"bytes"
	"compress/gzip"
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
	// TODO make this more robust and maybe set headers not to have to gzip
	proxy := ReverseProxyGnetReq(c.Logger, "/plugins", hs.Cfg.BuildVersion)
	proxy.Transport = grafanaComProxyTransport
	proxy.ModifyResponse = func(r *http.Response) error {
		// Early return
		if hs.AccessControl.IsDisabled() {
			return nil
		}

		b, errReadBody := hs.readBody(r)
		if errReadBody != nil {
			return errReadBody
		}

		rewriteResponse := func(b []byte) {
			body := io.NopCloser(bytes.NewReader(b))
			r.Body = body
			r.ContentLength = int64(len(b))
			r.Header.Set("Content-Length", strconv.Itoa(len(b)))
		}

		pluginList, errPluginList := hs.parsePluginList(r, b)
		if errPluginList != nil {
			return errPluginList
		}

		ok := hs.addMetadataToGNETPluginList(pluginList, c)
		if !ok {
			rewriteResponse(b)
		}

		newBody, errMarshal := json.Marshal(pluginList)
		if errMarshal != nil {
			rewriteResponse(b)
		}

		if r.Header.Get("Content-Encoding") == "gzip" {
			r.Header.Del("Content-Encoding")
		}

		rewriteResponse(newBody)
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

func (*HTTPServer) parsePluginList(r *http.Response, b []byte) (map[string]interface{}, error) {
	pluginList := map[string]interface{}{}
	if r.Header.Get("Content-Encoding") == "gzip" {
		r.Header.Del("Content-Length")
		zr, errUnzip := gzip.NewReader(bytes.NewReader(b))
		if errUnzip != nil {
			return nil, errUnzip
		}
		if errDecode := json.NewDecoder(zr).Decode(&pluginList); errDecode != nil {
			return nil, errDecode
		}
	} else {
		if errUnmarshal := json.Unmarshal(b, &pluginList); errUnmarshal != nil {
			return nil, errUnmarshal
		}
	}
	return pluginList, nil
}

func (*HTTPServer) readBody(r *http.Response) ([]byte, error) {
	b, errRead := io.ReadAll(r.Body)
	if errRead != nil {
		return nil, errRead
	}
	errClose := r.Body.Close()
	if errClose != nil {
		return nil, errClose
	}
	return b, nil
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

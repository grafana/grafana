package api

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io/ioutil"
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

func (hs *HTTPServer) ListGnetPlugins(c *models.ReqContext) {
	proxy := ReverseProxyGnetReq(c.Logger, "/plugins", hs.Cfg.BuildVersion)
	proxy.Transport = grafanaComProxyTransport
	proxy.ModifyResponse = func(r *http.Response) error {
		b, errRead := ioutil.ReadAll(r.Body)
		if errRead != nil {
			return errRead
		}
		errClose := r.Body.Close()
		if errClose != nil {
			return errClose
		}

		rewriteResponse := func(b []byte) {
			body := ioutil.NopCloser(bytes.NewReader(b))
			r.Body = body
			r.ContentLength = int64(len(b))
			r.Header.Set("Content-Length", strconv.Itoa(len(b)))
		}

		pluginList := map[string]interface{}{}
		if r.Header.Get("Content-Encoding") == "gzip" {
			r.Header.Del("Content-Length")
			zr, errUnzip := gzip.NewReader(bytes.NewReader(b))
			if errUnzip != nil {
				return errUnzip
			}
			if errDecode := json.NewDecoder(zr).Decode(&pluginList); errDecode != nil {
				return errDecode
			}
		} else {
			if errUnmarshal := json.Unmarshal(b, &pluginList); errUnmarshal != nil {
				return errUnmarshal
			}
		}

		items, ok := pluginList["items"].([]interface{})
		if !ok {
			rewriteResponse(b)
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

		if !hs.AccessControl.IsDisabled() {
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
		}

		pluginList["items"] = items
		newBody, errMarshal := json.Marshal(pluginList)
		if errMarshal != nil {
			rewriteResponse(b)
		}

		if r.Header.Get("Content-Encoding") == "gzip" {
			r.Header.Del("Content-Encoding")
		}

		hs.log.Info("=>>> pluginList", fmt.Sprintf("%v", pluginList))

		rewriteResponse(newBody)
		return nil
	}
	proxy.ServeHTTP(c.Resp, c.Req)
}

func (hs *HTTPServer) ProxyGnetRequest(c *models.ReqContext) {
	proxyPath := web.Params(c.Req)["*"]
	proxy := ReverseProxyGnetReq(c.Logger, proxyPath, hs.Cfg.BuildVersion)
	proxy.Transport = grafanaComProxyTransport
	proxy.ServeHTTP(c.Resp, c.Req)
}

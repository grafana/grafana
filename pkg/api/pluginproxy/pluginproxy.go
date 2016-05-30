package pluginproxy

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"text/template"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util"
)

type templateData struct {
	JsonData       map[string]interface{}
	SecureJsonData map[string]string
}

func getHeaders(route *plugins.AppPluginRoute, orgId int64, appId string) (http.Header, error) {
	result := http.Header{}

	query := m.GetPluginSettingByIdQuery{OrgId: orgId, PluginId: appId}

	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	data := templateData{
		JsonData:       query.Result.JsonData,
		SecureJsonData: query.Result.SecureJsonData.Decrypt(),
	}

	for _, header := range route.Headers {
		var contentBuf bytes.Buffer
		t, err := template.New("content").Parse(header.Content)
		if err != nil {
			return nil, errors.New(fmt.Sprintf("could not parse header content template for header %s.", header.Name))
		}

		err = t.Execute(&contentBuf, data)
		if err != nil {
			return nil, errors.New(fmt.Sprintf("failed to execute header content template for header %s.", header.Name))
		}

		log.Trace("Adding header to proxy request. %s: %s", header.Name, contentBuf.String())
		result.Add(header.Name, contentBuf.String())
	}

	return result, nil
}

func NewApiPluginProxy(ctx *middleware.Context, proxyPath string, route *plugins.AppPluginRoute, appId string) *httputil.ReverseProxy {
	targetUrl, _ := url.Parse(route.Url)

	director := func(req *http.Request) {

		req.URL.Scheme = targetUrl.Scheme
		req.URL.Host = targetUrl.Host
		req.Host = targetUrl.Host

		req.URL.Path = util.JoinUrlFragments(targetUrl.Path, proxyPath)

		// clear cookie headers
		req.Header.Del("Cookie")
		req.Header.Del("Set-Cookie")

		//Create a HTTP header with the context in it.
		ctxJson, err := json.Marshal(ctx.SignedInUser)
		if err != nil {
			ctx.JsonApiErr(500, "failed to marshal context to json.", err)
			return
		}

		req.Header.Add("X-Grafana-Context", string(ctxJson))

		if len(route.Headers) > 0 {
			headers, err := getHeaders(route, ctx.OrgId, appId)
			if err != nil {
				ctx.JsonApiErr(500, "Could not generate plugin route header", err)
				return
			}

			for key, value := range headers {
				log.Trace("setting key %v value %v", key, value[0])
				req.Header.Set(key, value[0])
			}
		}

	}

	return &httputil.ReverseProxy{Director: director}
}

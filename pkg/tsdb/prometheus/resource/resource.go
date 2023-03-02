package resource

import (
	"bytes"
	"fmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/utils"
)

import (
	"context"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/client"
	"github.com/grafana/grafana/pkg/util/maputil"
	"net/http"
)

type Resource struct {
	promClient *client.Client
	log        log.Logger
	cacheLevel string
}

func New(
	httpClient *http.Client,
	settings backend.DataSourceInstanceSettings,
	plog log.Logger,
) (*Resource, error) {
	jsonData, err := utils.GetJsonData(settings)
	if err != nil {
		return nil, err
	}
	httpMethod, _ := maputil.GetStringOptional(jsonData, "httpMethod")
	jsonDataBytes, simpleJsonErr := simplejson.NewJson(settings.JSONData)
	if simpleJsonErr != nil {
		return nil, err
	}
	cacheLevel, jsonGetErr := jsonDataBytes.Get("cacheLevel").String()
	if jsonGetErr != nil {
		return nil, err
	}

	return &Resource{
		log:        plog,
		promClient: client.NewClient(httpClient, httpMethod, settings.URL),
		cacheLevel: cacheLevel,
	}, nil
}

func (r *Resource) Execute(ctx context.Context, req *backend.CallResourceRequest) (*backend.CallResourceResponse, error) {
	r.log.FromContext(ctx).Debug("Sending resource query", "URL", req.URL)
	resp, err := r.promClient.QueryResource(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("error querying resource: %v", err)
	}

	if len(req.GetHTTPHeaders().Get("X-Grafana-Cache")) > 0 && len(req.GetHTTPHeaders().Get("Cache-Control")) > 0 {
		resp.Header.Set("X-Grafana-Cache", "y")
		resp.Header.Set("Cache-Control", req.GetHTTPHeaders().Get("Cache-Control"))
	}

	defer func() {
		tmpErr := resp.Body.Close()
		if tmpErr != nil && err == nil {
			err = tmpErr
		}
	}()

	var buf bytes.Buffer
	// Should be more efficient than ReadAll. See https://github.com/prometheus/client_golang/pull/976
	_, err = buf.ReadFrom(resp.Body)
	body := buf.Bytes()
	if err != nil {
		return nil, err
	}
	callResponse := &backend.CallResourceResponse{
		Status:  resp.StatusCode,
		Headers: resp.Header,
		Body:    body,
	}

	return callResponse, err
}

func (r *Resource) DetectVersion(ctx context.Context, req *backend.CallResourceRequest) (*backend.CallResourceResponse, error) {
	newReq := &backend.CallResourceRequest{
		PluginContext: req.PluginContext,
		Path:          "/api/v1/status/buildinfo",
	}

	resp, err := r.Execute(ctx, newReq)

	if err != nil {
		return nil, err
	}

	callResponse := &backend.CallResourceResponse{
		Status: 200,
		Body:   resp.Body,
	}

	return callResponse, nil
}

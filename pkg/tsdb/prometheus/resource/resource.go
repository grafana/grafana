package resource

import (
	"bytes"
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/client"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/utils"
	"github.com/grafana/grafana/pkg/util/maputil"
)

type Resource struct {
	promClient *client.Client
	log        log.Logger
}

// Hop-by-hop headers. These are removed when sent to the backend.
// http://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html
var hopHeaders = []string{
	"Connection",
	"Keep-Alive",
	"Proxy-Authenticate",
	"Proxy-Authorization",
	"Te", // canonicalized version of "TE"
	"Trailers",
	"Transfer-Encoding",
	"Upgrade",
}

// The following headers will be removed from the request
var stopHeaders = []string{
	"cookie",
	"Cookie",
}

func delHopHeaders(header http.Header) {
	for _, h := range hopHeaders {
		header.Del(h)
	}
}

func delStopHeaders(header http.Header) {
	for _, h := range stopHeaders {
		header.Del(h)
	}
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

	return &Resource{
		log:        plog,
		promClient: client.NewClient(httpClient, httpMethod, settings.URL),
	}, nil
}

func (r *Resource) Execute(ctx context.Context, req *backend.CallResourceRequest) (*backend.CallResourceResponse, error) {
	delHopHeaders(req.Headers)
	delStopHeaders(req.Headers)

	r.log.FromContext(ctx).Debug("Sending resource query", "URL", req.URL)
	resp, err := r.promClient.QueryResource(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("error querying resource: %v", err)
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

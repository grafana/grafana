package resource

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/client"
)

type Resource struct {
	provider      *client.Provider
	log           log.Logger
	customHeaders map[string]string
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

func addHeaders(header http.Header, toAdd map[string]string) {
	for k, v := range toAdd {
		header.Add(k, v)
	}
}

func normalizeReqHeaders(headers map[string][]string) map[string]string {
	h := make(map[string]string, len(headers))
	for k, v := range headers {
		h[k] = strings.Join(v, ",")
	}
	return h
}

func New(
	httpClientProvider httpclient.Provider,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	settings backend.DataSourceInstanceSettings,
	plog log.Logger,
) (*Resource, error) {
	var jsonData map[string]interface{}
	if err := json.Unmarshal(settings.JSONData, &jsonData); err != nil {
		return nil, fmt.Errorf("error reading settings: %w", err)
	}

	customHeaders := make(map[string]string)
	var jsonDataMap map[string]interface{}

	err := json.Unmarshal(settings.JSONData, &jsonDataMap)
	if err != nil {
		return nil, err
	}

	index := 1
	for {
		headerNameSuffix := fmt.Sprintf("httpHeaderName%d", index)
		headerValueSuffix := fmt.Sprintf("httpHeaderValue%d", index)

		key := jsonDataMap[headerNameSuffix]
		if key == nil {
			// No (more) header values are available
			break
		}

		if val, ok := settings.DecryptedSecureJSONData[headerValueSuffix]; ok {
			switch k := key.(type) {
			case string:
				customHeaders[k] = val
			}
		}
		index++
	}

	return &Resource{
		log:           plog,
		provider:      client.NewProvider(settings, jsonData, httpClientProvider, cfg, features, plog),
		customHeaders: customHeaders,
	}, nil
}

func (r *Resource) Execute(ctx context.Context, req *backend.CallResourceRequest) (int, []byte, error) {
	delHopHeaders(req.Headers)
	delStopHeaders(req.Headers)
	addHeaders(req.Headers, r.customHeaders)
	client, err := r.provider.GetClient(normalizeReqHeaders(req.Headers))
	if err != nil {
		return 500, nil, err
	}

	return r.fetch(ctx, client, req)
}

func (r *Resource) fetch(ctx context.Context, client *client.Client, req *backend.CallResourceRequest) (int, []byte, error) {
	r.log.Debug("Sending resource query", "URL", req.URL)
	resp, err := client.QueryResource(ctx, req)
	if err != nil {
		statusCode := 500
		if resp != nil {
			statusCode = resp.StatusCode
		}
		return statusCode, nil, err
	}

	defer func() {
		err = resp.Body.Close()
	}()

	// Check that the server actually sent compressed data
	var reader io.ReadCloser
	switch resp.Header.Get("Content-Encoding") {
	case "gzip":
		reader, err = gzip.NewReader(resp.Body)
		defer func() {
			err = reader.Close()
		}()
		if err != nil {
			return 500, nil, err
		}
	default:
		reader = resp.Body
	}

	data, err := ioutil.ReadAll(reader)
	if err != nil {
		return 500, nil, err
	}

	return resp.StatusCode, data, err
}

package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/client"
)

type Resource struct {
	provider *client.Provider
	log      log.Logger
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

// These headers simply do not work when set from the client, so
// strip them out before sending.
var removeHeaders = []string{
	"accept",
	"Accept-Encoding",
}

func delHopHeaders(header http.Header) {
	for _, h := range hopHeaders {
		header.Del(h)
	}
}

func delRemoveHeaders(header http.Header) {
	for _, h := range removeHeaders {
		header.Del(h)
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

	p := client.NewProvider(settings, jsonData, httpClientProvider, cfg, features, plog)

	return &Resource{
		log:      plog,
		provider: p,
	}, nil
}

func (r *Resource) Execute(ctx context.Context, req *backend.CallResourceRequest) (int, []byte, error) {
	delHopHeaders(req.Headers)
	delRemoveHeaders(req.Headers)
	client, err := r.provider.GetClient(normalizeReqHeaders(req.Headers))
	if err != nil {
		return 500, nil, err
	}

	return r.fetch(ctx, client, req)
}

func (r *Resource) fetch(ctx context.Context, client *client.Client, req *backend.CallResourceRequest) (int, []byte, error) {
	r.log.Debug("Sending resource query", "URL", req.URL)
	u, err := url.Parse(req.URL)
	if err != nil {
		return 500, nil, err
	}

	resp, err := client.QueryResource(ctx, req.Method, u.Path, u.Query())
	if err != nil {
		statusCode := 500
		if resp != nil {
			statusCode = resp.StatusCode
		}
		return statusCode, nil, err
	}

	defer resp.Body.Close() //nolint (we don't care about the error being returned by resp.Body.Close())

	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return 500, nil, err
	}

	return resp.StatusCode, data, err
}

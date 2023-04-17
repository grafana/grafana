package prometheus

import (
	// "context"
	// "bytes"
	// "encoding/json"
	// "io"
	// "net/http"
	"testing"
	// "github.com/grafana/grafana-plugin-sdk-go/backend"
	// sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	// "github.com/grafana/grafana/pkg/infra/httpclient"
	// "github.com/grafana/grafana/pkg/infra/log/logtest"
	// "github.com/grafana/grafana/pkg/infra/tracing"
	// "github.com/grafana/grafana/pkg/setting"
	// "github.com/grafana/grafana/pkg/tsdb/prometheus/client"
	// "github.com/grafana/grafana/pkg/tsdb/prometheus/querydata"
	// "github.com/grafana/grafana-plugin-sdk-go/backend"
	// "github.com/stretchr/testify/assert"
)

func Test_healthcheck(t *testing.T) {
	// the health check returns a successful health check, *backend.CheckHealthResult, from the /-/healthy api

	// the health check returns a successful *backend.CheckHealthResult based on a query when there is a 404 returned from the /-/healthy api
}

// type testContext struct {
// 	httpProvider *fakeHttpClientProvider
// 	queryData    *querydata.QueryData
// }

// func setup(wideFrames bool) (*testContext, error) {
// 	tracer := tracing.InitializeTracerForTest()
// 	httpProvider := &fakeHttpClientProvider{
// 		opts: sdkhttpclient.Options{
// 			Timeouts: &sdkhttpclient.DefaultTimeoutOptions,
// 		},
// 		res: &http.Response{
// 			StatusCode: 200,
// 			Body:       io.NopCloser(bytes.NewReader([]byte(`{}`))),
// 		},
// 	}
// 	settings := backend.DataSourceInstanceSettings{
// 		URL:      "http://localhost:9090",
// 		JSONData: json.RawMessage(`{"timeInterval": "15s"}`),
// 	}

// 	features := &fakeFeatureToggles{flags: map[string]bool{"prometheusBufferedClient": false,
// 		"prometheusWideSeries": wideFrames}}

// 	opts, err := client.CreateTransportOptions(settings, &setting.Cfg{}, &logtest.Fake{})
// 	if err != nil {
// 		return nil, err
// 	}

// 	httpClient, err := httpProvider.New(*opts)
// 	if err != nil {
// 		return nil, err
// 	}

// 	queryData, _ := querydata.New(httpClient, features, tracer, settings, &logtest.Fake{})

// 	return &testContext{
// 		httpProvider: httpProvider,
// 		queryData:    queryData,
// 	}, nil
// }

// type fakeFeatureToggles struct {
// 	flags map[string]bool
// }

// func (f *fakeFeatureToggles) IsEnabled(feature string) bool {
// 	return f.flags[feature]
// }

// type fakeHttpClientProvider struct {
// 	httpclient.Provider
// 	opts sdkhttpclient.Options
// 	req  *http.Request
// 	res  *http.Response
// }

// func (p *fakeHttpClientProvider) New(opts ...sdkhttpclient.Options) (*http.Client, error) {
// 	p.opts = opts[0]
// 	c, err := sdkhttpclient.New(opts[0])
// 	if err != nil {
// 		return nil, err
// 	}
// 	c.Transport = p
// 	return c, nil
// }

// func (p *fakeHttpClientProvider) GetTransport(opts ...sdkhttpclient.Options) (http.RoundTripper, error) {
// 	p.opts = opts[0]
// 	return http.DefaultTransport, nil
// }

// func (p *fakeHttpClientProvider) setResponse(res *http.Response) {
// 	p.res = res
// }

// func (p *fakeHttpClientProvider) RoundTrip(req *http.Request) (*http.Response, error) {
// 	p.req = req
// 	return p.res, nil
// }

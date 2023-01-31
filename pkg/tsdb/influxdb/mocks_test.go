package influxdb

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

type fakeHttpClientProvider struct {
	httpclient.Provider
	opts sdkhttpclient.Options
	res  *http.Response
	rt   RoundTripper
}

func (p *fakeHttpClientProvider) New(opts ...sdkhttpclient.Options) (*http.Client, error) {
	p.opts = opts[0]
	c, err := sdkhttpclient.New(opts[0])
	if err != nil {
		return nil, err
	}
	c.Transport = p
	return c, nil
}

func (p *fakeHttpClientProvider) GetTransport(opts ...sdkhttpclient.Options) (http.RoundTripper, error) {
	p.opts = opts[0]
	return http.DefaultTransport, nil
}

func (p *fakeHttpClientProvider) RoundTrip(req *http.Request) (*http.Response, error) {
	return p.rt.RoundTrip(req)
}

type fakeInstance struct {
	version          string
	fakeRoundTripper RoundTripper
}

func (f *fakeInstance) Get(pluginContext backend.PluginContext) (instancemgmt.Instance, error) {
	fp := &fakeHttpClientProvider{
		opts: sdkhttpclient.Options{
			Timeouts: &sdkhttpclient.DefaultTimeoutOptions,
		},
		res: &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(bytes.NewReader([]byte(`{}`))),
		},
		rt: f.fakeRoundTripper,
	}

	client, err := fp.New(sdkhttpclient.Options{})
	if err != nil {
		return nil, err
	}

	return &models.DatasourceInfo{
		HTTPClient:    client,
		Token:         "sometoken",
		URL:           "https://awesome-influx.com",
		DbName:        "testdb",
		Version:       f.version,
		HTTPMode:      "GET",
		TimeInterval:  "10s",
		DefaultBucket: "testbucket",
		Organization:  "testorg",
		MaxSeries:     2,
	}, nil
}

func (f *fakeInstance) Do(pluginContext backend.PluginContext, fn instancemgmt.InstanceCallbackFunc) error {
	return nil
}

type RoundTripper struct {
	Body     string
	FileName string // filename (relative path of where it is being called)
}

func (rt *RoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	res := &http.Response{
		StatusCode: http.StatusOK,
		Status:     "200 OK",
		Body:       io.NopCloser(bytes.NewBufferString("{}")),
	}
	if rt.Body != "" {
		res.Body = io.NopCloser(bytes.NewBufferString(rt.Body))
	}
	if rt.FileName != "" {
		b, err := os.ReadFile(rt.FileName)
		if err != nil {
			return res, fmt.Errorf("error reading testdata file %s", rt.FileName)
		}
		reader := io.NopCloser(bytes.NewReader(b))
		res.Body = reader
	}
	if res.Body != nil {
		return res, nil
	}
	return nil, errors.New("fake client not working as expected. If you got this error fix this method")
}

func GetMockService(version string, rt RoundTripper) *Service {
	return &Service{
		queryParser:    &InfluxdbQueryParser{},
		responseParser: &ResponseParser{},
		im: &fakeInstance{
			version:          version,
			fakeRoundTripper: rt,
		},
	}
}

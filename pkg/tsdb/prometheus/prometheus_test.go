package prometheus

import (
	"bytes"
	"compress/gzip"
	"context"
	"github.com/stretchr/testify/assert"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"
)

type fakeSender struct {
	resp *backend.CallResourceResponse
}

func (sender *fakeSender) Send(resp *backend.CallResourceResponse) error {
	sender.resp = resp
	return nil
}

type fakeRoundtripper struct {
	Req *http.Request
}

func (rt *fakeRoundtripper) RoundTrip(req *http.Request) (*http.Response, error) {
	rt.Req = req
	reqBody, _ := io.ReadAll(req.Body)
	respHeader := make(http.Header)
	if req.Header.Get("Accept-Encoding") == "gzip" {
		respHeader.Add("Content-Encoding", "gzip")
	}
	return &http.Response{
		Status:        "200",
		StatusCode:    200,
		Header:        respHeader,
		Body:          io.NopCloser(bytes.NewReader(reqBody)),
		ContentLength: 0,
	}, nil
}

type fakeHTTPClientProvider struct {
	httpclient.Provider
	Roundtripper *fakeRoundtripper
}

func (provider *fakeHTTPClientProvider) New(opts ...httpclient.Options) (*http.Client, error) {
	client := &http.Client{}
	provider.Roundtripper = &fakeRoundtripper{}
	client.Transport = provider.Roundtripper
	return client, nil
}

func (provider *fakeHTTPClientProvider) GetTransport(opts ...httpclient.Options) (http.RoundTripper, error) {
	return &fakeRoundtripper{}, nil
}

func getMockPromTestSDKProvider(f *fakeHTTPClientProvider) *httpclient.Provider {
	anotherFN := func(o httpclient.Options, next http.RoundTripper) http.RoundTripper {
		_, _ = f.New()
		return f.Roundtripper
	}
	fn := httpclient.MiddlewareFunc(anotherFN)
	mid := httpclient.NamedMiddlewareFunc("mock", fn)
	return httpclient.NewProvider(httpclient.ProviderOptions{Middlewares: []httpclient.Middleware{mid}})
}

func TestService(t *testing.T) {
	t.Run("Service", func(t *testing.T) {
		t.Run("CallResource", func(t *testing.T) {
			t.Run("creates correct request", func(t *testing.T) {
				f := &fakeHTTPClientProvider{}
				httpProvider := getMockPromTestSDKProvider(f)
				service := &Service{
					im: datasource.NewInstanceManager(newInstanceSettings(httpProvider, backend.NewLoggerWith("logger", "test"))),
				}

				req := &backend.CallResourceRequest{
					PluginContext: backend.PluginContext{
						OrgID:               0,
						PluginID:            "prometheus",
						User:                nil,
						AppInstanceSettings: nil,
						DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
							ID:               0,
							UID:              "",
							Type:             "prometheus",
							Name:             "test-prom",
							URL:              "http://localhost:9090",
							User:             "",
							Database:         "",
							BasicAuthEnabled: true,
							BasicAuthUser:    "admin",
							Updated:          time.Time{},
							JSONData:         []byte("{}"),
						},
					},
					Path:   "/api/v1/series",
					Method: http.MethodPost,
					URL:    "/api/v1/series",
					Body:   []byte("match%5B%5D: ALERTS\nstart: 1655271408\nend: 1655293008"),
				}

				sender := &fakeSender{}
				err := service.CallResource(context.Background(), req, sender)
				require.NoError(t, err)
				require.Equal(
					t,
					http.Header{
						"Content-Type":    {"application/x-www-form-urlencoded"},
						"Idempotency-Key": []string(nil),
					},
					f.Roundtripper.Req.Header)
				require.Equal(t, http.MethodPost, f.Roundtripper.Req.Method)
				require.Equal(t, []byte("match%5B%5D: ALERTS\nstart: 1655271408\nend: 1655293008"), sender.resp.Body)
				require.Equal(t, "http://localhost:9090/api/v1/series", f.Roundtripper.Req.URL.String())
			})

			t.Run("unGzip response of resource api", func(t *testing.T) {
				f := &fakeHTTPClientProvider{}
				httpProvider := getMockPromTestSDKProvider(f)
				service := &Service{
					im: datasource.NewInstanceManager(newInstanceSettings(httpProvider, backend.NewLoggerWith("logger", "test"))),
				}

				rawData := []byte("match%5B%5D: ALERTS\nstart: 1655271408\nend: 1655293008")
				buffer := bytes.NewBuffer(make([]byte, 0, 1024))
				gzipW := gzip.NewWriter(buffer)
				_, err := gzipW.Write(rawData)
				assert.Nil(t, err)
				err = gzipW.Close()
				assert.Nil(t, err)

				req := &backend.CallResourceRequest{
					PluginContext: backend.PluginContext{
						DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
							URL:      "http://localhost:9090",
							JSONData: []byte(`{"httpHeaderName1": "Accept-Encoding"}`),
							DecryptedSecureJSONData: map[string]string{
								"httpHeaderValue1": "gzip",
							},
						},
					},
					Path:   "/api/v1/series",
					Method: http.MethodPost,
					URL:    "/api/v1/series",
					Body:   buffer.Bytes(),
				}

				sender := &fakeSender{}
				err = service.CallResource(context.Background(), req, sender)
				require.NoError(t, err)
				require.Equal(t, http.MethodPost, f.Roundtripper.Req.Method)
				require.Equal(t, []byte("match%5B%5D: ALERTS\nstart: 1655271408\nend: 1655293008"), sender.resp.Body)
				require.Equal(t, "http://localhost:9090/api/v1/series", f.Roundtripper.Req.URL.String())
			})
		})
	})
}

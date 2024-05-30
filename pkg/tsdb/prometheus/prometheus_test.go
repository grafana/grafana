package prometheus

import (
	"context"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"
)

type fakeSender struct{}

func (sender *fakeSender) Send(resp *backend.CallResourceResponse) error {
	return nil
}

type fakeRoundtripper struct {
	Req *http.Request
}

func (rt *fakeRoundtripper) RoundTrip(req *http.Request) (*http.Response, error) {
	rt.Req = req
	return &http.Response{
		Status:        "200",
		StatusCode:    200,
		Header:        nil,
		Body:          nil,
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
						"Query-Source":    {"GRAFANA"}, // LOGZ.IO GRAFANA CHANGE :: DEV-43889 - Add headers for logzio datasources support
					},
					f.Roundtripper.Req.Header)
				require.Equal(t, http.MethodPost, f.Roundtripper.Req.Method)
				body, err := io.ReadAll(f.Roundtripper.Req.Body)
				require.NoError(t, err)
				require.Equal(t, []byte("match%5B%5D: ALERTS\nstart: 1655271408\nend: 1655293008"), body)
				require.Equal(t, "http://localhost:9090/api/v1/series", f.Roundtripper.Req.URL.String())
			})
		})
	})
}

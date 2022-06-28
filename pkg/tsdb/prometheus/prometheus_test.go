package prometheus

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	sdkHttpClient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

type fakeSender struct{}

func (sender *fakeSender) Send(resp *backend.CallResourceResponse) error {
	return nil
}

type fakeRoundtripper struct{}

func (rt *fakeRoundtripper) RoundTrip(req *http.Request) (*http.Response, error) {
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
	opts []sdkHttpClient.Options
}

func (provider *fakeHTTPClientProvider) New(opts ...sdkHttpClient.Options) (*http.Client, error) {
	client := &http.Client{}
	client.Transport = &fakeRoundtripper{}
	provider.opts = opts
	return client, nil
}

func TestClient(t *testing.T) {
	t.Run("Service", func(t *testing.T) {
		t.Run("CallResource", func(t *testing.T) {
			t.Run("Adds correct headers", func(t *testing.T) {
				// Not a great test as right now we put the headers form request and custom headers into a client during
				// it's creation and then relly on sdk middleware to add it to the request later on. This is hard to
				// test so for now this just checks if the correct headers are passed to the http client not whether
				// they are actually added to the request.

				httpProvider := &fakeHTTPClientProvider{}
				service := &Service{
					im: datasource.NewInstanceManager(newInstanceSettings(httpProvider, &setting.Cfg{}, &featuremgmt.FeatureManager{}, nil)),
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
							// Custom headers from data source configuration
							JSONData: []byte("{\"httpHeaderName1\":\"x-tenant-id\"}"),
							DecryptedSecureJSONData: map[string]string{
								"httpHeaderValue1": "0987",
							},
							Updated: time.Time{},
						},
					},
					Path:   "/api/v1/series",
					Method: http.MethodPost,
					URL:    "/api/v1/series",
					// Header in the request itself sent from the browser
					Headers: map[string][]string{
						"foo": {"bar"},
					},
					Body: []byte("match%5B%5D: ALERTS\nstart: 1655271408\nend: 1655293008"),
				}

				sender := &fakeSender{}
				err := service.CallResource(context.Background(), req, sender)
				require.NoError(t, err)
				require.Equal(t, map[string]string{"X-Tenant-Id": "0987", "foo": "bar"}, httpProvider.opts[0].Headers)
			})
		})
	})
}

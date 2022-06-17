package resource

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkHttpClient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

type fakeHttpClientProvider struct {
	httpclient.Provider
}

func (provider *fakeHttpClientProvider) New(opts ...sdkHttpClient.Options) (*http.Client, error) {
	return http.DefaultClient, nil
}

func TestClient(t *testing.T) {
	t.Run("Resource", func(t *testing.T) {

		t.Run("Execute", func(t *testing.T) {
			t.Run("Adds correct headers", func(t *testing.T) {
				// Add custom headers in the ds settings. Names are stored in json data but values are encrypted.
				datasourceSettings := backend.DataSourceInstanceSettings{
					JSONData: []byte("{\"httpHeaderName1\":\"x-tenant-id\"}"),
					DecryptedSecureJSONData: map[string]string{
						"httpHeaderValue1": "0987",
					},
				}
				resource, err := New(&fakeHttpClientProvider{}, &setting.Cfg{}, nil, datasourceSettings, log.New("request-logger"))
				require.NoError(t, err)

				status, body, err := resource.Execute(context.Background(), nil)

			})

		})

	})
}

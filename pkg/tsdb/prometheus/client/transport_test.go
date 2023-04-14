package client

import (
	"testing"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestCreateTransportOptions(t *testing.T) {
	t.Run("creates correct options object", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			BasicAuthEnabled: false,
			BasicAuthUser:    "",
			JSONData:         []byte(`{"httpHeaderName1": "foo"}`),
			DecryptedSecureJSONData: map[string]string{
				"httpHeaderValue1": "bar",
			},
		}
		opts, err := CreateTransportOptions(settings, &setting.Cfg{}, &logtest.Fake{})
		require.NoError(t, err)
		require.Equal(t, map[string]string{"foo": "bar"}, opts.Headers)
		require.Equal(t, 2, len(opts.Middlewares))
	})

	t.Run("add azure credentials if configured", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			BasicAuthEnabled: false,
			BasicAuthUser:    "",
			JSONData: []byte(`{
				"azureCredentials": {
					"authType": "msi"
				}
			}`),
			DecryptedSecureJSONData: map[string]string{},
		}
		opts, err := CreateTransportOptions(settings, &setting.Cfg{AzureAuthEnabled: true, Azure: &azsettings.AzureSettings{}}, &logtest.Fake{})
		require.NoError(t, err)
		require.Equal(t, 3, len(opts.Middlewares))
	})
}

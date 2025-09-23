package azureauth

import (
	"bytes"
	"context"
	"testing"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/hashicorp/go-hclog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeLogger struct {
	hclog.Logger

	level log.Level
}

func (l fakeLogger) Level() log.Level {
	return l.level
}
func (l fakeLogger) FromContext(ctx context.Context) log.Logger {
	return fakeLogger{}
}
func (l fakeLogger) With(args ...interface{}) log.Logger {
	return fakeLogger{}
}

func TestConfigureAzureAuthentication(t *testing.T) {
	azureSettings := &azsettings.AzureSettings{}
	testLogger := log.NewNullLogger()

	t.Run("should set Azure middleware when JsonData contains valid credentials", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			JSONData: []byte(`{
					"httpMethod": "POST",
					"azureCredentials": {
						"authType": "msi"
					}
				}`),
		}

		var opts = &sdkhttpclient.Options{CustomOptions: map[string]any{}}

		err := ConfigureAzureAuthentication(settings, azureSettings, opts, false, testLogger)
		require.NoError(t, err)

		require.NotNil(t, opts.Middlewares)
		assert.Len(t, opts.Middlewares, 1)
	})

	t.Run("should not set Azure middleware when JsonData doesn't contain valid credentials", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			JSONData: []byte(`{ "httpMethod": "POST" }`),
		}

		var opts = &sdkhttpclient.Options{CustomOptions: map[string]any{}}

		err := ConfigureAzureAuthentication(settings, azureSettings, opts, false, testLogger)
		require.NoError(t, err)

		assert.NotContains(t, opts.CustomOptions, "_azureCredentials")
	})

	t.Run("should return error when JsonData contains invalid credentials", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			JSONData: []byte(`{
					"httpMethod":       "POST",
					"azureCredentials": "invalid"
				}`),
		}

		var opts = &sdkhttpclient.Options{CustomOptions: map[string]any{}}
		err := ConfigureAzureAuthentication(settings, azureSettings, opts, false, testLogger)
		assert.Error(t, err)
	})

	t.Run("should set Azure middleware when JsonData contains credentials and valid audience", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			JSONData: []byte(`{
					"httpMethod": "POST",
					"azureCredentials": {
						"authType": "msi"
					},
					"azureEndpointResourceId": "https://api.example.com/abd5c4ce-ca73-41e9-9cb2-bed39aa2adb5"
				}`),
		}
		var opts = &sdkhttpclient.Options{CustomOptions: map[string]any{}}

		err := ConfigureAzureAuthentication(settings, azureSettings, opts, true, testLogger)
		require.NoError(t, err)

		require.NotNil(t, opts.Middlewares)
		assert.Len(t, opts.Middlewares, 1)
	})

	t.Run("should not set Azure middleware when JsonData doesn't contain credentials", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			JSONData: []byte(`{
					"httpMethod":              "POST",
					"azureEndpointResourceId": "https://api.example.com/abd5c4ce-ca73-41e9-9cb2-bed39aa2adb5"
				}`),
		}
		var opts = &sdkhttpclient.Options{CustomOptions: map[string]any{}}

		err := ConfigureAzureAuthentication(settings, azureSettings, opts, true, testLogger)
		require.NoError(t, err)

		if opts.Middlewares != nil {
			assert.Len(t, opts.Middlewares, 0)
		}
	})

	t.Run("should return error when JsonData contains invalid audience", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			JSONData: []byte(`{
					"httpMethod": "POST",
					"azureCredentials": {
						"authType": "msi"
					},
					"azureEndpointResourceId": "invalid"
				}`),
		}

		var opts = &sdkhttpclient.Options{CustomOptions: map[string]any{}}

		err := ConfigureAzureAuthentication(settings, azureSettings, opts, true, testLogger)
		assert.Error(t, err)
	})
	t.Run("should warn if an audience is specified and the feature toggle is not enabled", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			JSONData: []byte(`{
					"httpMethod": "POST",
					"azureCredentials": {
						"authType": "msi"
					},
					"azureEndpointResourceId": "https://api.example.com/abd5c4ce-ca73-41e9-9cb2-bed39aa2adb5"
				}`),
		}

		var opts = &sdkhttpclient.Options{CustomOptions: map[string]any{}}
		var buf bytes.Buffer
		testLogger := hclog.New(&hclog.LoggerOptions{
			Name:   "test",
			Output: &buf,
		})
		log := fakeLogger{
			Logger: testLogger,
		}

		err := ConfigureAzureAuthentication(settings, azureSettings, opts, false, log)
		str := buf.String()
		t.Log(str)
		assert.NoError(t, err)
		assert.Contains(t, str, "Specifying an audience override requires the prometheusAzureOverrideAudience feature toggle to be enabled. This functionality is deprecated and will be removed in a future release.")
	})
}

func TestGetPrometheusScopes(t *testing.T) {
	azureSettings := &azsettings.AzureSettings{
		Cloud: azsettings.AzureUSGovernment,
	}

	t.Run("should return scopes for cloud from settings with MSI credentials", func(t *testing.T) {
		credentials := &azcredentials.AzureManagedIdentityCredentials{}
		scopes, err := getPrometheusScopes(azureSettings, credentials)
		require.NoError(t, err)

		assert.NotNil(t, scopes)
		assert.Len(t, scopes, 1)
		assert.Equal(t, "https://prometheus.monitor.azure.us/.default", scopes[0])
	})

	t.Run("should return scopes for cloud from client secret credentials", func(t *testing.T) {
		credentials := &azcredentials.AzureClientSecretCredentials{AzureCloud: azsettings.AzureChina}
		scopes, err := getPrometheusScopes(azureSettings, credentials)
		require.NoError(t, err)

		assert.NotNil(t, scopes)
		assert.Len(t, scopes, 1)
		assert.Equal(t, "https://prometheus.monitor.azure.cn/.default", scopes[0])
	})
}

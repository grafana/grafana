package promclient

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfigureAzureAuthentication(t *testing.T) {
	cfg := &setting.Cfg{}
	settings := backend.DataSourceInstanceSettings{}

	t.Run("given feature flag enabled", func(t *testing.T) {
		features := featuremgmt.WithFeatures(featuremgmt.FlagPrometheusAzureAuth)

		t.Run("should set Azure middleware when JsonData contains valid credentials", func(t *testing.T) {
			jsonData := map[string]interface{}{
				"httpMethod": "POST",
				"azureCredentials": map[string]interface{}{
					"authType": "msi",
				},
				"azureEndpointResourceId": "https://api.example.com/abd5c4ce-ca73-41e9-9cb2-bed39aa2adb5",
			}

			var p = NewProvider(settings, jsonData, nil, cfg, features, nil)

			var opts = &sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

			err := p.configureAzureAuthentication(opts)
			require.NoError(t, err)

			require.NotNil(t, opts.Middlewares)
			assert.Len(t, opts.Middlewares, 1)
		})

		t.Run("should not set Azure middleware when JsonData doesn't contain valid credentials", func(t *testing.T) {
			jsonData := map[string]interface{}{
				"httpMethod": "POST",
			}

			var p = NewProvider(settings, jsonData, nil, cfg, features, nil)

			var opts = &sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

			err := p.configureAzureAuthentication(opts)
			require.NoError(t, err)

			assert.NotContains(t, opts.CustomOptions, "_azureCredentials")
		})

		t.Run("should return error when JsonData contains invalid credentials", func(t *testing.T) {
			jsonData := map[string]interface{}{
				"httpMethod":       "POST",
				"azureCredentials": "invalid",
			}

			var p = NewProvider(settings, jsonData, nil, cfg, features, nil)

			var opts = &sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

			err := p.configureAzureAuthentication(opts)
			assert.Error(t, err)
		})

		t.Run("should set Azure middleware when JsonData contains credentials and valid audience", func(t *testing.T) {
			jsonData := map[string]interface{}{
				"httpMethod": "POST",
				"azureCredentials": map[string]interface{}{
					"authType": "msi",
				},
				"azureEndpointResourceId": "https://api.example.com/abd5c4ce-ca73-41e9-9cb2-bed39aa2adb5",
			}

			var p = NewProvider(settings, jsonData, nil, cfg, features, nil)

			var opts = &sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

			err := p.configureAzureAuthentication(opts)
			require.NoError(t, err)

			require.NotNil(t, opts.Middlewares)
			assert.Len(t, opts.Middlewares, 1)
		})

		t.Run("should not set Azure middleware when JsonData doesn't contain credentials", func(t *testing.T) {
			jsonData := map[string]interface{}{
				"httpMethod":              "POST",
				"azureEndpointResourceId": "https://api.example.com/abd5c4ce-ca73-41e9-9cb2-bed39aa2adb5",
			}

			var p = NewProvider(settings, jsonData, nil, cfg, features, nil)

			var opts = &sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

			err := p.configureAzureAuthentication(opts)
			require.NoError(t, err)

			if opts.Middlewares != nil {
				assert.Len(t, opts.Middlewares, 0)
			}
		})

		t.Run("should return error when JsonData contains invalid audience", func(t *testing.T) {
			jsonData := map[string]interface{}{
				"httpMethod": "POST",
				"azureCredentials": map[string]interface{}{
					"authType": "msi",
				},
				"azureEndpointResourceId": "invalid",
			}

			var p = NewProvider(settings, jsonData, nil, cfg, features, nil)

			var opts = &sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

			err := p.configureAzureAuthentication(opts)
			assert.Error(t, err)
		})
	})

	t.Run("given feature flag not enabled", func(t *testing.T) {
		features := featuremgmt.WithFeatures()

		t.Run("should not set Azure Credentials even when JsonData contains credentials", func(t *testing.T) {
			jsonData := map[string]interface{}{
				"httpMethod": "POST",
				"azureCredentials": map[string]interface{}{
					"authType": "msi",
				},
				"azureEndpointResourceId": "https://api.example.com/abd5c4ce-ca73-41e9-9cb2-bed39aa2adb5",
			}

			var p = NewProvider(settings, jsonData, nil, cfg, features, nil)

			var opts = &sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

			err := p.configureAzureAuthentication(opts)
			require.NoError(t, err)

			if opts.Middlewares != nil {
				assert.Len(t, opts.Middlewares, 0)
			}
		})
	})
}

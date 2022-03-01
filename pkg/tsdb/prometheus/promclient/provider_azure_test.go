package promclient

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfigureAzureAuthentication(t *testing.T) {
	settings := backend.DataSourceInstanceSettings{}

	t.Run("given feature flag enabled", func(t *testing.T) {
		features := featuremgmt.WithFeatures(featuremgmt.FlagPrometheusAzureAuth)

		t.Run("should set Azure Credentials when JsonData contains valid credentials", func(t *testing.T) {
			jsonData := map[string]interface{}{
				"httpMethod": "POST",
				"azureCredentials": map[string]interface{}{
					"authType": "msi",
				},
				"azureEndpointResourceId": "https://api.example.com/abd5c4ce-ca73-41e9-9cb2-bed39aa2adb5",
			}

			var p = NewProvider(settings, jsonData, nil, features, nil)

			var opts = sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

			err := p.configureAzureAuthentication(opts)
			require.NoError(t, err)

			assert.Contains(t, opts.CustomOptions, "_azureCredentials")
			credentials := opts.CustomOptions["_azureCredentials"]

			assert.IsType(t, &azcredentials.AzureManagedIdentityCredentials{}, credentials)
		})

		t.Run("should not set Azure Credentials when JsonData doesn't contain valid credentials", func(t *testing.T) {
			jsonData := map[string]interface{}{
				"httpMethod": "POST",
			}

			var p = NewProvider(settings, jsonData, nil, features, nil)

			var opts = sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

			err := p.configureAzureAuthentication(opts)
			require.NoError(t, err)

			assert.NotContains(t, opts.CustomOptions, "_azureCredentials")
		})

		t.Run("should return error when JsonData contains invalid credentials", func(t *testing.T) {
			jsonData := map[string]interface{}{
				"httpMethod":       "POST",
				"azureCredentials": "invalid",
			}

			var p = NewProvider(settings, jsonData, nil, features, nil)

			var opts = sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

			err := p.configureAzureAuthentication(opts)
			assert.Error(t, err)
		})

		t.Run("should set Azure Scopes when JsonData contains credentials and valid audience", func(t *testing.T) {
			jsonData := map[string]interface{}{
				"httpMethod": "POST",
				"azureCredentials": map[string]interface{}{
					"authType": "msi",
				},
				"azureEndpointResourceId": "https://api.example.com/abd5c4ce-ca73-41e9-9cb2-bed39aa2adb5",
			}

			var p = NewProvider(settings, jsonData, nil, features, nil)

			var opts = sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

			err := p.configureAzureAuthentication(opts)
			require.NoError(t, err)

			assert.Contains(t, opts.CustomOptions, "_azureScopes")

			require.IsType(t, []string{}, opts.CustomOptions["_azureScopes"])
			scopes := opts.CustomOptions["_azureScopes"].([]string)

			assert.Len(t, scopes, 1)
			assert.Equal(t, "https://api.example.com/abd5c4ce-ca73-41e9-9cb2-bed39aa2adb5/.default", scopes[0])
		})

		t.Run("should not set Azure Scopes when JsonData doesn't contain credentials", func(t *testing.T) {
			jsonData := map[string]interface{}{
				"httpMethod":              "POST",
				"azureEndpointResourceId": "https://api.example.com/abd5c4ce-ca73-41e9-9cb2-bed39aa2adb5",
			}

			var p = NewProvider(settings, jsonData, nil, features, nil)

			var opts = sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

			err := p.configureAzureAuthentication(opts)
			require.NoError(t, err)

			assert.NotContains(t, opts.CustomOptions, "_azureScopes")
		})

		t.Run("should return error when JsonData contains invalid audience", func(t *testing.T) {
			jsonData := map[string]interface{}{
				"httpMethod": "POST",
				"azureCredentials": map[string]interface{}{
					"authType": "msi",
				},
				"azureEndpointResourceId": "invalid",
			}

			var p = NewProvider(settings, jsonData, nil, features, nil)

			var opts = sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

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

			var p = NewProvider(settings, jsonData, nil, features, nil)

			var opts = sdkhttpclient.Options{CustomOptions: map[string]interface{}{}}

			err := p.configureAzureAuthentication(opts)
			require.NoError(t, err)

			assert.NotContains(t, opts.CustomOptions, "_azureCredentials")
			assert.NotContains(t, opts.CustomOptions, "_azureScopes")
		})
	})
}

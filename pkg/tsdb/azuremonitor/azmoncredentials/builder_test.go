package azmoncredentials

import (
	"testing"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFromDatasourceData(t *testing.T) {
	t.Run("should return nil when no credentials configured", func(t *testing.T) {
		var data = map[string]any{}
		var secureData = map[string]string{}

		result, err := FromDatasourceData(data, secureData)
		require.NoError(t, err)

		assert.Nil(t, result)
	})

	t.Run("should return managed identity credentials when auth type is managed identity", func(t *testing.T) {
		data := map[string]any{
			"azureAuthType": "msi",
			"cloudName":     "chinaazuremonitor",
			"tenantId":      "LEGACY-TENANT-ID",
			"clientId":      "LEGACY-CLIENT-ID",
		}
		var secureData = map[string]string{
			"clientSecret": "FAKE-LEGACY-SECRET",
		}

		credentials, err := FromDatasourceData(data, secureData)
		require.NoError(t, err)
		require.IsType(t, &azcredentials.AzureManagedIdentityCredentials{}, credentials)
		msiCredentials := credentials.(*azcredentials.AzureManagedIdentityCredentials)

		// Azure Monitor datasource doesn't support user-assigned managed identities (ClientId is always empty)
		assert.Equal(t, "", msiCredentials.ClientId)
	})

	t.Run("should return workload identity credentials when auth type is workload identity", func(t *testing.T) {
		data := map[string]any{
			"azureAuthType": azcredentials.AzureAuthWorkloadIdentity,
		}
		var secureData = map[string]string{}

		credentials, err := FromDatasourceData(data, secureData)
		require.NoError(t, err)
		require.IsType(t, &azcredentials.AzureWorkloadIdentityCredentials{}, credentials)
	})

	t.Run("when legacy client secret configuration present", func(t *testing.T) {
		t.Run("should return client secret credentials when auth type is client secret", func(t *testing.T) {
			var data = map[string]any{
				"azureAuthType": "clientsecret",
				"cloudName":     "chinaazuremonitor",
				"tenantId":      "LEGACY-TENANT-ID",
				"clientId":      "LEGACY-CLIENT-ID",
			}
			var secureData = map[string]string{
				"clientSecret": "FAKE-LEGACY-SECRET",
			}

			result, err := FromDatasourceData(data, secureData)
			require.NoError(t, err)

			require.NotNil(t, result)
			assert.IsType(t, &azcredentials.AzureClientSecretCredentials{}, result)
			credential := (result).(*azcredentials.AzureClientSecretCredentials)

			assert.Equal(t, azsettings.AzureChina, credential.AzureCloud)
			assert.Equal(t, "LEGACY-TENANT-ID", credential.TenantId)
			assert.Equal(t, "LEGACY-CLIENT-ID", credential.ClientId)
			assert.Equal(t, "FAKE-LEGACY-SECRET", credential.ClientSecret)
		})

		t.Run("should return client secret credentials when auth type is not specified but configuration present", func(t *testing.T) {
			var data = map[string]any{
				"cloudName": "chinaazuremonitor",
				"tenantId":  "LEGACY-TENANT-ID",
				"clientId":  "LEGACY-CLIENT-ID",
			}
			var secureData = map[string]string{
				"clientSecret": "FAKE-LEGACY-SECRET",
			}

			result, err := FromDatasourceData(data, secureData)
			require.NoError(t, err)

			require.NotNil(t, result)
			assert.IsType(t, &azcredentials.AzureClientSecretCredentials{}, result)
			credential := (result).(*azcredentials.AzureClientSecretCredentials)

			assert.Equal(t, azsettings.AzureChina, credential.AzureCloud)
			assert.Equal(t, "LEGACY-TENANT-ID", credential.TenantId)
			assert.Equal(t, "LEGACY-CLIENT-ID", credential.ClientId)
			assert.Equal(t, "FAKE-LEGACY-SECRET", credential.ClientSecret)
		})

		t.Run("should error if no client secret is set", func(t *testing.T) {
			var data = map[string]any{
				"azureAuthType": "clientsecret",
				"cloudName":     "chinaazuremonitor",
				"tenantId":      "LEGACY-TENANT-ID",
				"clientId":      "LEGACY-CLIENT-ID",
			}
			var secureData = map[string]string{}

			_, err := FromDatasourceData(data, secureData)
			require.Error(t, err)

			assert.ErrorContains(t, err, "clientSecret must be set")
		})
	})

	t.Run("should return client secret credentials when client secret auth configured even if legacy configuration present", func(t *testing.T) {
		var data = map[string]any{
			"azureCredentials": map[string]any{
				"authType":   "clientsecret",
				"azureCloud": "AzureChinaCloud",
				"tenantId":   "TENANT-ID",
				"clientId":   "CLIENT-TD",
			},
			"azureAuthType": "clientsecret",
			"cloudName":     "azuremonitor",
			"tenantId":      "LEGACY-TENANT-ID",
			"clientId":      "LEGACY-CLIENT-ID",
		}
		var secureData = map[string]string{
			"azureClientSecret": "FAKE-SECRET",
			"clientSecret":      "FAKE-LEGACY-SECRET",
		}

		result, err := FromDatasourceData(data, secureData)
		require.NoError(t, err)

		require.NotNil(t, result)
		assert.IsType(t, &azcredentials.AzureClientSecretCredentials{}, result)
		credential := (result).(*azcredentials.AzureClientSecretCredentials)

		assert.Equal(t, credential.AzureCloud, azsettings.AzureChina)
		assert.Equal(t, credential.TenantId, "TENANT-ID")
		assert.Equal(t, credential.ClientId, "CLIENT-TD")
		assert.Equal(t, credential.ClientSecret, "FAKE-SECRET")
	})

	t.Run("should return error when credentials not supported even if legacy configuration present", func(t *testing.T) {
		var data = map[string]any{
			"azureCredentials": map[string]any{
				"authType":   "invalid",
				"azureCloud": "AzureChinaCloud",
				"tenantId":   "TENANT-ID",
				"clientId":   "CLIENT-TD",
			},
			"cloudName":     "azuremonitor",
			"tenantId":      "LEGACY-TENANT-ID",
			"clientId":      "LEGACY-CLIENT-ID",
			"onBehalfOf":    true,
			"oauthPassThru": true,
		}
		var secureData = map[string]string{
			"azureClientSecret": "FAKE-SECRET",
			"clientSecret":      "FAKE-LEGACY-SECRET",
		}

		_, err := FromDatasourceData(data, secureData)
		assert.Error(t, err)
	})
}

func TestNormalizedCloudName(t *testing.T) {
	t.Run("should return normalized cloud name", func(t *testing.T) {
		tests := []struct {
			description     string
			legacyCloud     string
			normalizedCloud string
		}{
			{
				legacyCloud:     azureMonitorPublic,
				normalizedCloud: azsettings.AzurePublic,
			},
			{
				legacyCloud:     azureMonitorChina,
				normalizedCloud: azsettings.AzureChina,
			},
			{
				legacyCloud:     azureMonitorUSGovernment,
				normalizedCloud: azsettings.AzureUSGovernment,
			},
			{
				legacyCloud:     "",
				normalizedCloud: azsettings.AzurePublic,
			},
		}

		for _, tt := range tests {
			t.Run(tt.description, func(t *testing.T) {
				actualCloud, err := resolveLegacyCloudName(tt.legacyCloud)
				require.NoError(t, err)

				assert.Equal(t, tt.normalizedCloud, actualCloud)
			})
		}
	})

	t.Run("should fail when cloud is unknown", func(t *testing.T) {
		legacyCloud := "unknown"

		_, err := resolveLegacyCloudName(legacyCloud)
		assert.Error(t, err)
	})
}

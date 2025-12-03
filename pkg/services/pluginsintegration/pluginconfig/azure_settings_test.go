package pluginconfig

import (
	"testing"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsso"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetAzureSettings(t *testing.T) {
	t.Run("no Azure settings input", func(t *testing.T) {
		result := mergeAzureSettings(nil, nil)

		assert.Nil(t, result)
	})

	t.Run("no SSO settings or override settings", func(t *testing.T) {
		currSettings := &azsettings.AzureSettings{
			UserIdentityTokenEndpoint: &azsettings.TokenEndpointSettings{
				TokenUrl:             "original-token-url",
				ClientAuthentication: "original-auth",
				ClientId:             "original-client-id",
				ClientSecret:         "original-client-secret",
			},
		}

		azureAdSettings := &pluginsso.Settings{
			Values: map[string]any{},
		}

		result := mergeAzureSettings(currSettings, azureAdSettings)

		assert.Equal(t, "original-token-url", result.UserIdentityTokenEndpoint.TokenUrl)
		assert.Equal(t, "original-auth", result.UserIdentityTokenEndpoint.ClientAuthentication)
		assert.Equal(t, "original-client-id", result.UserIdentityTokenEndpoint.ClientId)
		assert.Equal(t, "original-client-secret", result.UserIdentityTokenEndpoint.ClientSecret)
	})

	t.Run("with SSO settings but no overrides", func(t *testing.T) {
		currSettings := &azsettings.AzureSettings{
			UserIdentityTokenEndpoint: &azsettings.TokenEndpointSettings{
				TokenUrl:                            "original-token-url",
				ClientAuthentication:                "original-auth",
				ClientId:                            "original-client-id",
				ClientSecret:                        "original-client-secret",
				ManagedIdentityClientId:             "original-managed-id",
				FederatedCredentialAudience:         "original-audience",
				TokenUrlOverride:                    false,
				ClientAuthenticationOverride:        false,
				ClientIdOverride:                    false,
				ClientSecretOverride:                false,
				ManagedIdentityClientIdOverride:     false,
				FederatedCredentialAudienceOverride: false,
			},
		}

		azureAdSettings := &pluginsso.Settings{
			Values: map[string]any{
				"token_url":                     "sso-token-url",
				"client_authentication":         "sso-auth",
				"client_id":                     "sso-client-id",
				"client_secret":                 "sso-client-secret",
				"managed_identity_client_id":    "sso-managed-id",
				"federated_credential_audience": "sso-audience",
			},
		}

		result := mergeAzureSettings(currSettings, azureAdSettings)

		assert.Equal(t, "sso-token-url", result.UserIdentityTokenEndpoint.TokenUrl)
		assert.Equal(t, "sso-auth", result.UserIdentityTokenEndpoint.ClientAuthentication)
		assert.Equal(t, "sso-client-id", result.UserIdentityTokenEndpoint.ClientId)
		assert.Equal(t, "sso-client-secret", result.UserIdentityTokenEndpoint.ClientSecret)
		assert.Equal(t, "sso-managed-id", result.UserIdentityTokenEndpoint.ManagedIdentityClientId)
		assert.Equal(t, "sso-audience", result.UserIdentityTokenEndpoint.FederatedCredentialAudience)
	})

	t.Run("with both overrides and SSO settings", func(t *testing.T) {
		currSettings := &azsettings.AzureSettings{
			UserIdentityTokenEndpoint: &azsettings.TokenEndpointSettings{
				TokenUrl:                            "override-token-url",
				ClientAuthentication:                "override-auth",
				ClientId:                            "override-client-id",
				ClientSecret:                        "override-client-secret",
				ManagedIdentityClientId:             "override-managed-id",
				FederatedCredentialAudience:         "override-audience",
				TokenUrlOverride:                    true,
				ClientAuthenticationOverride:        true,
				ClientIdOverride:                    true,
				ClientSecretOverride:                true,
				ManagedIdentityClientIdOverride:     true,
				FederatedCredentialAudienceOverride: true,
			},
		}

		azureAdSettings := &pluginsso.Settings{
			Values: map[string]any{
				"token_url":                     "sso-token-url",
				"client_authentication":         "sso-auth",
				"client_id":                     "sso-client-id",
				"client_secret":                 "sso-client-secret",
				"managed_identity_client_id":    "sso-managed-id",
				"federated_credential_audience": "sso-audience",
			},
		}

		result := mergeAzureSettings(currSettings, azureAdSettings)

		// Should keep override values, not SSO values
		assert.Equal(t, "override-token-url", result.UserIdentityTokenEndpoint.TokenUrl)
		assert.Equal(t, "override-auth", result.UserIdentityTokenEndpoint.ClientAuthentication)
		assert.Equal(t, "override-client-id", result.UserIdentityTokenEndpoint.ClientId)
		assert.Equal(t, "override-client-secret", result.UserIdentityTokenEndpoint.ClientSecret)
		assert.Equal(t, "override-managed-id", result.UserIdentityTokenEndpoint.ManagedIdentityClientId)
		assert.Equal(t, "override-audience", result.UserIdentityTokenEndpoint.FederatedCredentialAudience)
	})

	t.Run("client authentication 'none' should be ignored", func(t *testing.T) {
		currSettings := &azsettings.AzureSettings{
			UserIdentityTokenEndpoint: &azsettings.TokenEndpointSettings{
				ClientAuthentication:         "original-auth",
				ClientAuthenticationOverride: false,
			},
		}

		azureAdSettings := &pluginsso.Settings{
			Values: map[string]any{
				"client_authentication": "none",
			},
		}

		result := mergeAzureSettings(currSettings, azureAdSettings)

		assert.Equal(t, "original-auth", result.UserIdentityTokenEndpoint.ClientAuthentication)
	})

	t.Run("non-string values should be ignored", func(t *testing.T) {
		currSettings := &azsettings.AzureSettings{
			UserIdentityTokenEndpoint: &azsettings.TokenEndpointSettings{
				TokenUrl:         "original-token-url",
				ClientId:         "original-client-id",
				TokenUrlOverride: false,
				ClientIdOverride: false,
			},
		}

		azureAdSettings := &pluginsso.Settings{
			Values: map[string]any{
				"token_url": 12345,
				"client_id": []string{"array", "value"},
			},
		}

		result := mergeAzureSettings(currSettings, azureAdSettings)

		assert.Equal(t, "original-token-url", result.UserIdentityTokenEndpoint.TokenUrl)
		assert.Equal(t, "original-client-id", result.UserIdentityTokenEndpoint.ClientId)
	})

	t.Run("Nil UserIdentityTokenEndpoint should not panic", func(t *testing.T) {
		currSettings := &azsettings.AzureSettings{
			UserIdentityTokenEndpoint: nil,
		}

		azureAdSettings := &pluginsso.Settings{
			Values: map[string]any{
				"token_url": "sso-token-url",
			},
		}

		require.NotPanics(t, func() {
			mergeAzureSettings(currSettings, azureAdSettings)
		})
	})

	t.Run("Empty SSO settings map", func(t *testing.T) {
		currSettings := &azsettings.AzureSettings{
			UserIdentityTokenEndpoint: &azsettings.TokenEndpointSettings{
				TokenUrl:             "original-token-url",
				ClientAuthentication: "original-auth",
				ClientId:             "original-client-id",
			},
		}

		azureAdSettings := &pluginsso.Settings{
			Values: map[string]any{},
		}

		result := mergeAzureSettings(currSettings, azureAdSettings)

		assert.Equal(t, "original-token-url", result.UserIdentityTokenEndpoint.TokenUrl)
		assert.Equal(t, "original-auth", result.UserIdentityTokenEndpoint.ClientAuthentication)
		assert.Equal(t, "original-client-id", result.UserIdentityTokenEndpoint.ClientId)
	})
}

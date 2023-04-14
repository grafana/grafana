package setting

import (
	"testing"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAzureSettings(t *testing.T) {
	t.Run("cloud name", func(t *testing.T) {
		testCases := []struct {
			name            string
			configuredValue string
			resolvedValue   string
		}{
			{
				name:            "should be Public if not set",
				configuredValue: "",
				resolvedValue:   azsettings.AzurePublic,
			},
			{
				name:            "should be Public if set to Public",
				configuredValue: azsettings.AzurePublic,
				resolvedValue:   azsettings.AzurePublic,
			},
			{
				name:            "should be Public if set to Public using alternative name",
				configuredValue: "AzurePublicCloud",
				resolvedValue:   azsettings.AzurePublic,
			},
			{
				name:            "should be China if set to China",
				configuredValue: azsettings.AzureChina,
				resolvedValue:   azsettings.AzureChina,
			},
			{
				name:            "should be US Government if set to US Government using alternative name",
				configuredValue: "usgov",
				resolvedValue:   azsettings.AzureUSGovernment,
			},
			{
				name:            "should be same as set if not known",
				configuredValue: "Custom123",
				resolvedValue:   "Custom123",
			},
		}

		for _, c := range testCases {
			t.Run(c.name, func(t *testing.T) {
				cfg := NewCfg()

				azureSection, err := cfg.Raw.NewSection("azure")
				require.NoError(t, err)
				_, err = azureSection.NewKey("cloud", c.configuredValue)
				require.NoError(t, err)

				cfg.readAzureSettings()
				require.NotNil(t, cfg.Azure)

				assert.Equal(t, c.resolvedValue, cfg.Azure.Cloud)
			})
		}
	})

	t.Run("User Identity", func(t *testing.T) {

		t.Run("should be disabled by default", func(t *testing.T) {
			cfg := NewCfg()

			cfg.readAzureSettings()
			require.NotNil(t, cfg.Azure)

			assert.False(t, cfg.Azure.UserIdentityEnabled)
		})

		t.Run("should be enabled", func(t *testing.T) {
			cfg := NewCfg()
			azureSection, err := cfg.Raw.NewSection("azure")
			require.NoError(t, err)

			_, err = azureSection.NewKey("user_identity_enabled", "true")
			require.NoError(t, err)

			cfg.readAzureSettings()
			require.NotNil(t, cfg.Azure)
			require.NotNil(t, cfg.Azure.UserIdentityTokenEndpoint)

			assert.True(t, cfg.Azure.UserIdentityEnabled)
		})

		t.Run("should use token endpoint from Azure AD if enabled", func(t *testing.T) {
			cfg := NewCfg()
			azureAdSection, err := cfg.Raw.NewSection("auth.azuread")
			require.NoError(t, err)
			azureSection, err := cfg.Raw.NewSection("azure")
			require.NoError(t, err)

			_, err = azureAdSection.NewKey("enabled", "true")
			require.NoError(t, err)
			_, err = azureAdSection.NewKey("token_url", "URL_1")
			require.NoError(t, err)
			_, err = azureAdSection.NewKey("client_id", "ID_1")
			require.NoError(t, err)
			_, err = azureAdSection.NewKey("client_secret", "SECRET_1")
			require.NoError(t, err)

			_, err = azureSection.NewKey("user_identity_enabled", "true")
			require.NoError(t, err)

			cfg.readAzureSettings()
			require.NotNil(t, cfg.Azure)
			require.NotNil(t, cfg.Azure.UserIdentityTokenEndpoint)

			assert.True(t, cfg.Azure.UserIdentityEnabled)
			assert.Equal(t, "URL_1", cfg.Azure.UserIdentityTokenEndpoint.TokenUrl)
			assert.Equal(t, "ID_1", cfg.Azure.UserIdentityTokenEndpoint.ClientId)
			assert.Equal(t, "SECRET_1", cfg.Azure.UserIdentityTokenEndpoint.ClientSecret)
		})

		t.Run("should not use token endpoint from Azure AD if not enabled", func(t *testing.T) {
			cfg := NewCfg()
			azureAdSection, err := cfg.Raw.NewSection("auth.azuread")
			require.NoError(t, err)
			azureSection, err := cfg.Raw.NewSection("azure")
			require.NoError(t, err)

			_, err = azureAdSection.NewKey("enabled", "false")
			require.NoError(t, err)
			_, err = azureAdSection.NewKey("token_url", "URL_1")
			require.NoError(t, err)
			_, err = azureAdSection.NewKey("client_id", "ID_1")
			require.NoError(t, err)
			_, err = azureAdSection.NewKey("client_secret", "SECRET_1")
			require.NoError(t, err)

			_, err = azureSection.NewKey("user_identity_enabled", "true")
			require.NoError(t, err)

			cfg.readAzureSettings()
			require.NotNil(t, cfg.Azure)
			require.NotNil(t, cfg.Azure.UserIdentityTokenEndpoint)

			assert.True(t, cfg.Azure.UserIdentityEnabled)
			assert.Empty(t, cfg.Azure.UserIdentityTokenEndpoint.TokenUrl)
			assert.Empty(t, cfg.Azure.UserIdentityTokenEndpoint.ClientId)
			assert.Empty(t, cfg.Azure.UserIdentityTokenEndpoint.ClientSecret)
		})

		t.Run("should override Azure AD settings", func(t *testing.T) {
			cfg := NewCfg()
			azureAdSection, err := cfg.Raw.NewSection("auth.azuread")
			require.NoError(t, err)
			azureSection, err := cfg.Raw.NewSection("azure")
			require.NoError(t, err)

			_, err = azureAdSection.NewKey("enabled", "true")
			require.NoError(t, err)
			_, err = azureAdSection.NewKey("token_url", "URL_1")
			require.NoError(t, err)
			_, err = azureAdSection.NewKey("client_id", "ID_1")
			require.NoError(t, err)
			_, err = azureAdSection.NewKey("client_secret", "SECRET_1")
			require.NoError(t, err)

			_, err = azureSection.NewKey("user_identity_enabled", "true")
			require.NoError(t, err)
			_, err = azureSection.NewKey("user_identity_token_url", "URL_2")
			require.NoError(t, err)
			_, err = azureSection.NewKey("user_identity_client_id", "ID_2")
			require.NoError(t, err)
			_, err = azureSection.NewKey("user_identity_client_secret", "SECRET_2")
			require.NoError(t, err)

			cfg.readAzureSettings()
			require.NotNil(t, cfg.Azure)
			require.NotNil(t, cfg.Azure.UserIdentityTokenEndpoint)

			assert.True(t, cfg.Azure.UserIdentityEnabled)
			assert.Equal(t, "URL_2", cfg.Azure.UserIdentityTokenEndpoint.TokenUrl)
			assert.Equal(t, "ID_2", cfg.Azure.UserIdentityTokenEndpoint.ClientId)
			assert.Equal(t, "SECRET_2", cfg.Azure.UserIdentityTokenEndpoint.ClientSecret)
		})
	})
}

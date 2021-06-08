package tokenprovider

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var getAccessTokenFunc func(credential TokenCredential, scopes []string)

type tokenCacheFake struct{}

func (c *tokenCacheFake) GetAccessToken(ctx context.Context, credential TokenCredential, scopes []string) (string, error) {
	getAccessTokenFunc(credential, scopes)
	return "4cb83b87-0ffb-4abd-82f6-48a8c08afc53", nil
}

func TestAzureTokenProvider_isManagedIdentityCredential(t *testing.T) {
	ctx := context.Background()

	cfg := &setting.Cfg{}

	authParams := &plugins.JwtTokenAuth{
		Scopes: []string{
			"https://management.azure.com/.default",
		},
		Params: map[string]string{
			"azure_auth_type": "",
			"azure_cloud":     "AzureCloud",
			"tenant_id":       "",
			"client_id":       "",
			"client_secret":   "",
		},
	}

	provider := NewAzureAccessTokenProvider(ctx, cfg, authParams)

	t.Run("when managed identities enabled", func(t *testing.T) {
		cfg.Azure.ManagedIdentityEnabled = true

		t.Run("should be managed identity if auth type is managed identity", func(t *testing.T) {
			authParams.Params = map[string]string{
				"azure_auth_type": "msi",
			}

			assert.True(t, provider.isManagedIdentityCredential())
		})

		t.Run("should be client secret if auth type is client secret", func(t *testing.T) {
			authParams.Params = map[string]string{
				"azure_auth_type": "clientsecret",
			}

			assert.False(t, provider.isManagedIdentityCredential())
		})

		t.Run("should be managed identity if datasource not configured", func(t *testing.T) {
			authParams.Params = map[string]string{
				"azure_auth_type": "",
				"tenant_id":       "",
				"client_id":       "",
				"client_secret":   "",
			}

			assert.True(t, provider.isManagedIdentityCredential())
		})

		t.Run("should be client secret if auth type not specified but credentials configured", func(t *testing.T) {
			authParams.Params = map[string]string{
				"azure_auth_type": "",
				"tenant_id":       "06da9207-bdd9-4558-aee4-377450893cb4",
				"client_id":       "b8c58fe8-1fca-4e30-a0a8-b44d0e5f70d6",
				"client_secret":   "9bcd4434-824f-4887-a8a8-94c287bf0a7b",
			}

			assert.False(t, provider.isManagedIdentityCredential())
		})
	})

	t.Run("when managed identities disabled", func(t *testing.T) {
		cfg.Azure.ManagedIdentityEnabled = false

		t.Run("should be managed identity if auth type is managed identity", func(t *testing.T) {
			authParams.Params = map[string]string{
				"azure_auth_type": "msi",
			}

			assert.True(t, provider.isManagedIdentityCredential())
		})

		t.Run("should be client secret if datasource not configured", func(t *testing.T) {
			authParams.Params = map[string]string{
				"azure_auth_type": "",
				"tenant_id":       "",
				"client_id":       "",
				"client_secret":   "",
			}

			assert.False(t, provider.isManagedIdentityCredential())
		})
	})
}

func TestAzureTokenProvider_getAccessToken(t *testing.T) {
	ctx := context.Background()

	cfg := &setting.Cfg{}

	authParams := &plugins.JwtTokenAuth{
		Scopes: []string{
			"https://management.azure.com/.default",
		},
		Params: map[string]string{
			"azure_auth_type": "",
			"azure_cloud":     "AzureCloud",
			"tenant_id":       "",
			"client_id":       "",
			"client_secret":   "",
		},
	}

	provider := NewAzureAccessTokenProvider(ctx, cfg, authParams)

	original := azureTokenCache
	azureTokenCache = &tokenCacheFake{}
	t.Cleanup(func() { azureTokenCache = original })

	t.Run("when managed identities enabled", func(t *testing.T) {
		cfg.Azure.ManagedIdentityEnabled = true

		t.Run("should resolve managed identity credential if auth type is managed identity", func(t *testing.T) {
			authParams.Params = map[string]string{
				"azure_auth_type": "msi",
			}

			getAccessTokenFunc = func(credential TokenCredential, scopes []string) {
				assert.IsType(t, &managedIdentityCredential{}, credential)
			}

			_, err := provider.GetAccessToken()
			require.NoError(t, err)
		})

		t.Run("should resolve client secret credential if auth type is client secret", func(t *testing.T) {
			authParams.Params = map[string]string{
				"azure_auth_type": "clientsecret",
			}

			getAccessTokenFunc = func(credential TokenCredential, scopes []string) {
				assert.IsType(t, &clientSecretCredential{}, credential)
			}

			_, err := provider.GetAccessToken()
			require.NoError(t, err)
		})
	})

	t.Run("when managed identities disabled", func(t *testing.T) {
		cfg.Azure.ManagedIdentityEnabled = false

		t.Run("should return error if auth type is managed identity", func(t *testing.T) {
			authParams.Params = map[string]string{
				"azure_auth_type": "msi",
			}

			getAccessTokenFunc = func(credential TokenCredential, scopes []string) {
				assert.Fail(t, "token cache not expected to be called")
			}

			_, err := provider.GetAccessToken()
			require.Error(t, err)
		})
	})
}

func TestAzureTokenProvider_getClientSecretCredential(t *testing.T) {
	ctx := context.Background()

	cfg := &setting.Cfg{}

	authParams := &plugins.JwtTokenAuth{
		Scopes: []string{
			"https://management.azure.com/.default",
		},
		Params: map[string]string{
			"azure_auth_type": "",
			"azure_cloud":     "AzureCloud",
			"tenant_id":       "7dcf1d1a-4ec0-41f2-ac29-c1538a698bc4",
			"client_id":       "1af7c188-e5b6-4f96-81b8-911761bdd459",
			"client_secret":   "0416d95e-8af8-472c-aaa3-15c93c46080a",
		},
	}

	provider := NewAzureAccessTokenProvider(ctx, cfg, authParams)

	t.Run("should return clientSecretCredential with values", func(t *testing.T) {
		result := provider.getClientSecretCredential()
		assert.IsType(t, &clientSecretCredential{}, result)

		credential := (result).(*clientSecretCredential)

		assert.Equal(t, "https://login.microsoftonline.com/", credential.authority)
		assert.Equal(t, "7dcf1d1a-4ec0-41f2-ac29-c1538a698bc4", credential.tenantId)
		assert.Equal(t, "1af7c188-e5b6-4f96-81b8-911761bdd459", credential.clientId)
		assert.Equal(t, "0416d95e-8af8-472c-aaa3-15c93c46080a", credential.clientSecret)
	})
}

package aztokenprovider

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var getAccessTokenFunc func(credential TokenRetriever, scopes []string)

type tokenCacheFake struct{}

func (c *tokenCacheFake) GetAccessToken(_ context.Context, credential TokenRetriever, scopes []string) (string, error) {
	getAccessTokenFunc(credential, scopes)
	return "4cb83b87-0ffb-4abd-82f6-48a8c08afc53", nil
}

func TestAzureTokenProvider_GetAccessToken(t *testing.T) {
	ctx := context.Background()

	cfg := &setting.Cfg{}

	scopes := []string{
		"https://management.azure.com/.default",
	}

	original := azureTokenCache
	azureTokenCache = &tokenCacheFake{}
	t.Cleanup(func() { azureTokenCache = original })

	t.Run("when managed identities enabled", func(t *testing.T) {
		cfg.Azure.ManagedIdentityEnabled = true

		t.Run("should resolve managed identity retriever if auth type is managed identity", func(t *testing.T) {
			credentials := &azcredentials.AzureManagedIdentityCredentials{}

			provider, err := NewAzureAccessTokenProvider(cfg, credentials)
			require.NoError(t, err)

			getAccessTokenFunc = func(credential TokenRetriever, scopes []string) {
				assert.IsType(t, &managedIdentityTokenRetriever{}, credential)
			}

			_, err = provider.GetAccessToken(ctx, scopes)
			require.NoError(t, err)
		})

		t.Run("should resolve client secret retriever if auth type is client secret", func(t *testing.T) {
			credentials := &azcredentials.AzureClientSecretCredentials{}

			provider, err := NewAzureAccessTokenProvider(cfg, credentials)
			require.NoError(t, err)

			getAccessTokenFunc = func(credential TokenRetriever, scopes []string) {
				assert.IsType(t, &clientSecretTokenRetriever{}, credential)
			}

			_, err = provider.GetAccessToken(ctx, scopes)
			require.NoError(t, err)
		})
	})

	t.Run("when managed identities disabled", func(t *testing.T) {
		cfg.Azure.ManagedIdentityEnabled = false

		t.Run("should return error if auth type is managed identity", func(t *testing.T) {
			credentials := &azcredentials.AzureManagedIdentityCredentials{}

			_, err := NewAzureAccessTokenProvider(cfg, credentials)
			assert.Error(t, err, "managed identity authentication is not enabled in Grafana config")
		})
	})
}

func TestAzureTokenProvider_getClientSecretCredential(t *testing.T) {
	credentials := &azcredentials.AzureClientSecretCredentials{
		AzureCloud:   setting.AzurePublic,
		Authority:    "",
		TenantId:     "7dcf1d1a-4ec0-41f2-ac29-c1538a698bc4",
		ClientId:     "1af7c188-e5b6-4f96-81b8-911761bdd459",
		ClientSecret: "0416d95e-8af8-472c-aaa3-15c93c46080a",
	}

	t.Run("should return clientSecretTokenRetriever with values", func(t *testing.T) {
		result := getClientSecretTokenRetriever(credentials)
		assert.IsType(t, &clientSecretTokenRetriever{}, result)

		credential := (result).(*clientSecretTokenRetriever)

		assert.Equal(t, "https://login.microsoftonline.com/", credential.authority)
		assert.Equal(t, "7dcf1d1a-4ec0-41f2-ac29-c1538a698bc4", credential.tenantId)
		assert.Equal(t, "1af7c188-e5b6-4f96-81b8-911761bdd459", credential.clientId)
		assert.Equal(t, "0416d95e-8af8-472c-aaa3-15c93c46080a", credential.clientSecret)
	})

	t.Run("authority should selected based on cloud", func(t *testing.T) {
		originalCloud := credentials.AzureCloud
		defer func() { credentials.AzureCloud = originalCloud }()

		credentials.AzureCloud = setting.AzureChina

		result := getClientSecretTokenRetriever(credentials)
		assert.IsType(t, &clientSecretTokenRetriever{}, result)

		credential := (result).(*clientSecretTokenRetriever)

		assert.Equal(t, "https://login.chinacloudapi.cn/", credential.authority)
	})

	t.Run("explicitly set authority should have priority over cloud", func(t *testing.T) {
		originalCloud := credentials.AzureCloud
		defer func() { credentials.AzureCloud = originalCloud }()

		credentials.AzureCloud = setting.AzureChina
		credentials.Authority = "https://another.com/"

		result := getClientSecretTokenRetriever(credentials)
		assert.IsType(t, &clientSecretTokenRetriever{}, result)

		credential := (result).(*clientSecretTokenRetriever)

		assert.Equal(t, "https://another.com/", credential.authority)
	})
}

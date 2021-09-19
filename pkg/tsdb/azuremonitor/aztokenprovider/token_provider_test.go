package aztokenprovider

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/grafana/grafana/pkg/util/proxyutil"
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
		cfg.Azure.UserIdentityEnabled = true

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

		t.Run("should resolve user identity retriever if auth type is user identity", func(t *testing.T) {
			credentials := &azcredentials.AzureUserIdentityCredentials{}

			provider, err := NewAzureAccessTokenProvider(cfg, credentials)
			require.NoError(t, err)

			getAccessTokenFunc = func(credential TokenRetriever, scopes []string) {
				assert.IsType(t, &userIdentityTokenRetriever{}, credential)
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

	t.Run("when user identities disabled", func(t *testing.T) {
		cfg.Azure.UserIdentityEnabled = false

		t.Run("should return error if auth type is user identity", func(t *testing.T) {
			credentials := &azcredentials.AzureUserIdentityCredentials{}

			_, err := NewAzureAccessTokenProvider(cfg, credentials)
			assert.Error(t, err, "user identity authentication is not enabled in Grafana config")
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

func TestAzureTokenProvider_GetUserIdAccessToken(t *testing.T) {
	cfg := &setting.Cfg{
		Azure: setting.AzureSettings{
			UserIdentityEnabled: true,
		},
	}
	ctx := context.Background()

	credentials := &azcredentials.AzureUserIdentityCredentials{
		TokenEndpoint: "https://test.io",
		AuthHeader:    "Bear xxxxx",
	}

	scope := []string{"testresource/.default"}

	t.Run("return error if there is no signed in user", func(t *testing.T) {
		tokenRetriver := getUserIdentityTokenRetriever(cfg, credentials)
		assert.IsType(t, &userIdentityTokenRetriever{}, tokenRetriver)

		_, err := tokenRetriver.GetAccessToken(ctx, scope)
		assert.Error(t, err, "failed to get signed-in user")
	})

	t.Run("return error if there is empty signed in user", func(t *testing.T) {
		tokenRetriver := getUserIdentityTokenRetriever(cfg, credentials)
		assert.IsType(t, &userIdentityTokenRetriever{}, tokenRetriver)

		ctx = context.WithValue(ctx, proxyutil.ContextKeyLoginUser{}, "")
		_, err := tokenRetriver.GetAccessToken(ctx, scope)
		assert.Error(t, err, "empty signed-in userId")
	})
}

func TestAzureTokenProvider_GetAccessTokenFromResponse(t *testing.T) {
	cfg := &setting.Cfg{
		Azure: setting.AzureSettings{
			UserIdentityEnabled: true,
		},
	}

	credentials := &azcredentials.AzureUserIdentityCredentials{
		TokenEndpoint: "https://test.io",
		AuthHeader:    "Bear xxxxx",
	}

	t.Run("Successful token parse", func(t *testing.T) {
		value := struct {
			Token     string      `json:"access_token"`
			ExpiresIn json.Number `json:"expires_in"`
			ExpiresOn string      `json:"expires_on"`
		}{
			Token:     "testtoken",
			ExpiresIn: "1000",
		}
		data, err := json.Marshal(value)
		assert.Empty(t, err, "Failed to marshal data")

		body := io.NopCloser(bytes.NewReader(data))
		var resp = &http.Response{
			StatusCode: 200,
			Body:       body,
		}
		tokenRetriver := getUserIdentityTokenRetriever(cfg, credentials).(*userIdentityTokenRetriever)
		token, err := tokenRetriver.getAccessTokenFromResponse(resp)
		assert.Empty(t, err, "Failed on getting token")

		assert.Equal(t, value.Token, token.Token)

		timeMin := time.Now().UTC().Add(time.Second * 950)
		timeMax := timeMin.Add(time.Second * 100)
		assert.True(t, token.ExpiresOn.After(timeMin), "token.ExpiresOn is not after timeMin")
		assert.True(t, token.ExpiresOn.Before(timeMax), "token.ExpiresOn is not before timeMax")
	})

	t.Run("Fail token parse on bad status code", func(t *testing.T) {
		value := struct {
			Token     string      `json:"access_token"`
			ExpiresIn json.Number `json:"expires_in"`
			ExpiresOn string      `json:"expires_on"`
		}{
			Token:     "testtoken",
			ExpiresIn: "1000",
		}
		data, err := json.Marshal(value)
		assert.Empty(t, err, "Failed to marshal data")

		body := io.NopCloser(bytes.NewReader(data))
		var resp = &http.Response{
			StatusCode: 401,
			Body:       body,
		}
		tokenRetriver := getUserIdentityTokenRetriever(cfg, credentials).(*userIdentityTokenRetriever)
		_, err = tokenRetriver.getAccessTokenFromResponse(resp)
		assert.Error(t, err, "Bad statuscode on token request: 401")
	})

	t.Run("Fail token parse on bad data", func(t *testing.T) {
		data, err := json.Marshal("bad test")
		assert.Empty(t, err, "Failed to marshal data")

		body := io.NopCloser(bytes.NewReader(data))
		var resp = &http.Response{
			StatusCode: 200,
			Body:       body,
		}
		tokenRetriver := getUserIdentityTokenRetriever(cfg, credentials).(*userIdentityTokenRetriever)
		_, err = tokenRetriver.getAccessTokenFromResponse(resp)
		assert.Contains(t, err.Error(), "Failed to deserialize token response")
	})

	t.Run("Fail token parse on bad expiresIn", func(t *testing.T) {
		value := struct {
			Token     string      `json:"access_token"`
			ExpiresIn json.Number `json:"expires_in"`
			ExpiresOn string      `json:"expires_on"`
		}{
			Token:     "testtoken",
			ExpiresIn: "99.999",
		}
		data, err := json.Marshal(value)
		assert.Empty(t, err, "Failed to marshal data")

		body := io.NopCloser(bytes.NewReader(data))
		var resp = &http.Response{
			StatusCode: 200,
			Body:       body,
		}
		tokenRetriver := getUserIdentityTokenRetriever(cfg, credentials).(*userIdentityTokenRetriever)
		_, err = tokenRetriver.getAccessTokenFromResponse(resp)
		assert.Contains(t, err.Error(), "Faile to get ExpiresIn property of the token")
	})
}

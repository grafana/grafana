package client

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
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
		opts, err := CreateTransportOptions(context.Background(), settings, backend.NewLoggerWith("logger", "test"))
		require.NoError(t, err)
		require.Equal(t, http.Header{"Foo": []string{"bar"}}, opts.Header)
		require.Equal(t, 1, len(opts.Middlewares))
	})

	t.Run("creates options with OAuth2 client credentials middleware", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			BasicAuthEnabled: false,
			BasicAuthUser:    "",
			JSONData: []byte(`{
				"oauth2ClientCredentials": true,
				"oauth2ClientId": "my-client-id",
				"oauth2TokenUrl": "https://auth.example.com/token",
				"oauth2Scopes": "read,write"
			}`),
			DecryptedSecureJSONData: map[string]string{
				"oauth2ClientSecret": "my-client-secret",
			},
		}
		opts, err := CreateTransportOptions(context.Background(), settings, backend.NewLoggerWith("logger", "test"))
		require.NoError(t, err)
		// Should have: custom query params + oauth2 client credentials = 2 middlewares
		require.Equal(t, 2, len(opts.Middlewares))
	})

	t.Run("does not add OAuth2 middleware when disabled", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			BasicAuthEnabled: false,
			BasicAuthUser:    "",
			JSONData: []byte(`{
				"oauth2ClientCredentials": false,
				"oauth2ClientId": "my-client-id",
				"oauth2TokenUrl": "https://auth.example.com/token"
			}`),
			DecryptedSecureJSONData: map[string]string{
				"oauth2ClientSecret": "my-client-secret",
			},
		}
		opts, err := CreateTransportOptions(context.Background(), settings, backend.NewLoggerWith("logger", "test"))
		require.NoError(t, err)
		require.Equal(t, 1, len(opts.Middlewares))
	})

	t.Run("does not add OAuth2 middleware when secret is missing", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			BasicAuthEnabled: false,
			BasicAuthUser:    "",
			JSONData: []byte(`{
				"oauth2ClientCredentials": true,
				"oauth2ClientId": "my-client-id",
				"oauth2TokenUrl": "https://auth.example.com/token"
			}`),
			DecryptedSecureJSONData: map[string]string{},
		}
		opts, err := CreateTransportOptions(context.Background(), settings, backend.NewLoggerWith("logger", "test"))
		require.NoError(t, err)
		require.Equal(t, 1, len(opts.Middlewares))
	})
}

func TestGetOAuth2ClientCredentialsConfig(t *testing.T) {
	t.Run("returns nil when not enabled", func(t *testing.T) {
		jsonData := map[string]any{
			"oauth2ClientCredentials": false,
		}
		cfg := getOAuth2ClientCredentialsConfig(jsonData, map[string]string{})
		require.Nil(t, cfg)
	})

	t.Run("returns nil when client ID is missing", func(t *testing.T) {
		jsonData := map[string]any{
			"oauth2ClientCredentials": true,
			"oauth2TokenUrl":          "https://auth.example.com/token",
		}
		secureData := map[string]string{
			"oauth2ClientSecret": "secret",
		}
		cfg := getOAuth2ClientCredentialsConfig(jsonData, secureData)
		require.Nil(t, cfg)
	})

	t.Run("returns config with scopes and endpoint params", func(t *testing.T) {
		jsonData := map[string]any{
			"oauth2ClientCredentials": true,
			"oauth2ClientId":          "my-client",
			"oauth2TokenUrl":          "https://auth.example.com/token",
			"oauth2Scopes":            "read, write, admin",
			"oauth2EndpointParams":    "audience=https://api.example.com&resource=my-resource",
		}
		secureData := map[string]string{
			"oauth2ClientSecret": "my-secret",
		}
		cfg := getOAuth2ClientCredentialsConfig(jsonData, secureData)
		require.NotNil(t, cfg)
		require.Equal(t, "my-client", cfg.ClientID)
		require.Equal(t, "my-secret", cfg.ClientSecret)
		require.Equal(t, "https://auth.example.com/token", cfg.TokenURL)
		require.Equal(t, []string{"read", "write", "admin"}, cfg.Scopes)
		require.Equal(t, map[string][]string{
			"audience": {"https://api.example.com"},
			"resource": {"my-resource"},
		}, cfg.EndpointParams)
	})
}

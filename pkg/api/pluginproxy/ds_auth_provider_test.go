package pluginproxy

import (
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyRoute_interpolateAuthParams(t *testing.T) {
	pluginRoute := &plugins.AppPluginRoute{
		Path:   "pathwithjwttoken1",
		URL:    "https://api.jwt.io/some/path",
		Method: "GET",
		TokenAuth: &plugins.JwtTokenAuth{
			Url: "https://login.server.com/{{.JsonData.tenantId}}/oauth2/token",
			Scopes: []string{
				"https://www.testapi.com/auth/Read.All",
				"https://www.testapi.com/auth/Write.All",
			},
			Params: map[string]string{
				"token_uri":    "{{.JsonData.tokenUri}}",
				"client_email": "{{.JsonData.clientEmail}}",
				"private_key":  "{{.SecureJsonData.privateKey}}",
			},
		},
	}

	templateData := templateData{
		JsonData: map[string]interface{}{
			"clientEmail": "test@test.com",
			"tokenUri":    "login.url.com/token",
			"tenantId":    "f09c86ac",
		},
		SecureJsonData: map[string]string{
			"privateKey": "testkey",
		},
	}

	t.Run("should interpolate JwtTokenAuth struct using given JsonData", func(t *testing.T) {
		interpolated, err := interpolateAuthParams(pluginRoute.TokenAuth, templateData)
		require.NoError(t, err)
		require.NotNil(t, interpolated)

		assert.Equal(t, "https://login.server.com/f09c86ac/oauth2/token", interpolated.Url)

		assert.Equal(t, 2, len(interpolated.Scopes))
		assert.Equal(t, "https://www.testapi.com/auth/Read.All", interpolated.Scopes[0])
		assert.Equal(t, "https://www.testapi.com/auth/Write.All", interpolated.Scopes[1])

		assert.Equal(t, "login.url.com/token", interpolated.Params["token_uri"])
		assert.Equal(t, "test@test.com", interpolated.Params["client_email"])
		assert.Equal(t, "testkey", interpolated.Params["private_key"])
	})

	t.Run("should return Nil if given JwtTokenAuth is Nil", func(t *testing.T) {
		interpolated, err := interpolateAuthParams(pluginRoute.JwtTokenAuth, templateData)
		require.NoError(t, err)
		require.Nil(t, interpolated)
	})
}

package pluginproxy

import (
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyRoute_interpolateAuthParams(t *testing.T) {
	tokenAuth := &plugins.JWTTokenAuth{
		Url: "https://login.server.com/{{.JsonData.tenantId}}/oauth2/token",
		Scopes: []string{
			"https://www.testapi.com/auth/Read.All",
			"https://www.testapi.com/auth/Write.All",
		},
		Params: map[string]string{
			"token_uri":    "{{.JsonData.tokenUri}}",
			"client_email": "{{.JsonData.clientEmail | orEmpty}}",
			"private_key":  "{{.SecureJsonData.privateKey | orEmpty}}",
		},
	}

	validData := templateData{
		JsonData: map[string]interface{}{
			"clientEmail": "test@test.com",
			"tokenUri":    "login.url.com/token",
			"tenantId":    "f09c86ac",
		},
		SecureJsonData: map[string]string{
			"privateKey": "testkey",
		},
	}

	emptyData := templateData{
		JsonData:       map[string]interface{}{},
		SecureJsonData: map[string]string{},
	}

	t.Run("should interpolate JWTTokenAuth struct using given JsonData", func(t *testing.T) {
		interpolated, err := interpolateAuthParams(tokenAuth, validData)
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

	t.Run("should return Nil if given JWTTokenAuth is Nil", func(t *testing.T) {
		interpolated, err := interpolateAuthParams(nil, validData)
		require.NoError(t, err)
		require.Nil(t, interpolated)
	})

	t.Run("when plugin data is empty", func(t *testing.T) {
		interpolated, err := interpolateAuthParams(tokenAuth, emptyData)
		require.NoError(t, err)
		require.NotNil(t, interpolated)

		t.Run("template expressions in url should resolve to <no value>", func(t *testing.T) {
			assert.Equal(t, "https://login.server.com/<no value>/oauth2/token", interpolated.Url)
		})

		t.Run("template expressions in params resolve to <no value>", func(t *testing.T) {
			assert.Equal(t, "<no value>", interpolated.Params["token_uri"])
		})

		t.Run("template expressions with orEmpty should resolve to empty string", func(t *testing.T) {
			assert.Equal(t, "", interpolated.Params["client_email"])
			assert.Equal(t, "", interpolated.Params["private_key"])
		})
	})
}

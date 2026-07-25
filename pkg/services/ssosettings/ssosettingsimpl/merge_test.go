package ssosettingsimpl

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/login/social"
)

func TestMergeSettings_JWTKeySourceGroup(t *testing.T) {
	t.Run("does not backfill a JWT key source that is absent from the stored settings", func(t *testing.T) {
		stored := map[string]any{"key_file": "/etc/grafana/key.pem"}
		system := map[string]any{
			"jwk_set_url":  "https://example.com/jwks.json",
			"jwk_set_file": "/etc/grafana/jwks.json",
			"key_value":    "inline-key",
		}

		merged := mergeSettings(social.JWTProviderName, stored, system)

		require.Equal(t, "/etc/grafana/key.pem", merged["key_file"])
		require.NotContains(t, merged, "jwk_set_url")
		require.NotContains(t, merged, "jwk_set_file")
		require.NotContains(t, merged, "key_value")
	})

	t.Run("does not overwrite an intentionally empty jwk_set_url for JWT", func(t *testing.T) {
		stored := map[string]any{
			"key_file":    "/etc/grafana/key.pem",
			"jwk_set_url": "",
		}
		system := map[string]any{"jwk_set_url": "https://example.com/jwks.json"}

		merged := mergeSettings(social.JWTProviderName, stored, system)

		require.Equal(t, "", merged["jwk_set_url"])
	})

	t.Run("still backfills the JWT bearer-token modifier, which is not a key source", func(t *testing.T) {
		stored := map[string]any{"jwk_set_url": "https://example.com/jwks.json"}
		system := map[string]any{"jwk_set_bearer_token_file": "/etc/grafana/token"}

		merged := mergeSettings(social.JWTProviderName, stored, system)

		require.Equal(t, "/etc/grafana/token", merged["jwk_set_bearer_token_file"])
	})

	t.Run("still backfills jwk_set_url for OAuth providers", func(t *testing.T) {
		stored := map[string]any{"client_id": "id"}
		system := map[string]any{"jwk_set_url": "https://example.com/jwks.json"}

		merged := mergeSettings(social.GenericOAuthProviderName, stored, system)

		require.Equal(t, "https://example.com/jwks.json", merged["jwk_set_url"])
	})

	t.Run("still merges non key-source fields and backfills non-JWT empty URLs", func(t *testing.T) {
		stored := map[string]any{"auth_url": ""}
		system := map[string]any{
			"auth_url":     "https://example.com/authorize",
			"auto_sign_up": true,
		}

		merged := mergeSettings(social.GenericOAuthProviderName, stored, system)

		require.Equal(t, "https://example.com/authorize", merged["auth_url"])
		require.Equal(t, true, merged["auto_sign_up"])
	})
}

package ssosettingsimpl

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMergeSettings_JWTKeySourceGroup(t *testing.T) {
	t.Run("does not backfill a JWT key source that is absent from the stored settings", func(t *testing.T) {
		stored := map[string]any{"key_file": "/etc/grafana/key.pem"}
		system := map[string]any{
			"jwk_set_url":  "https://example.com/jwks.json",
			"jwk_set_file": "/etc/grafana/jwks.json",
			"key_value":    "inline-key",
		}

		merged := mergeSettings(stored, system)

		require.Equal(t, "/etc/grafana/key.pem", merged["key_file"])
		require.NotContains(t, merged, "jwk_set_url")
		require.NotContains(t, merged, "jwk_set_file")
		require.NotContains(t, merged, "key_value")
	})

	t.Run("does not overwrite an intentionally empty jwk_set_url from system settings", func(t *testing.T) {
		stored := map[string]any{
			"key_file":    "/etc/grafana/key.pem",
			"jwk_set_url": "",
		}
		system := map[string]any{"jwk_set_url": "https://example.com/jwks.json"}

		merged := mergeSettings(stored, system)

		require.Equal(t, "", merged["jwk_set_url"])
	})

	t.Run("still merges non key-source fields and backfills non-JWT empty URLs", func(t *testing.T) {
		stored := map[string]any{"auth_url": ""}
		system := map[string]any{
			"auth_url":     "https://example.com/authorize",
			"auto_sign_up": true,
		}

		merged := mergeSettings(stored, system)

		require.Equal(t, "https://example.com/authorize", merged["auth_url"])
		require.Equal(t, true, merged["auto_sign_up"])
	})
}

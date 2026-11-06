package models

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeSettings(t *testing.T) {
	t.Run("nil input returns nil", func(t *testing.T) {
		assert.Nil(t, NormalizeSettings(nil))
	})

	t.Run("converts camelCase keys to snake_case", func(t *testing.T) {
		input := map[string]any{
			"orgMapping":       "org-a-Admin:OrgA:Admin",
			"orgAttributePath": "grafana_orgs",
			"clientId":         "test-client-id",
			"clientSecret":     "test-secret",
		}

		result := NormalizeSettings(input)

		assert.Equal(t, map[string]any{
			"org_mapping":        "org-a-Admin:OrgA:Admin",
			"org_attribute_path": "grafana_orgs",
			"client_id":          "test-client-id",
			"client_secret":      "test-secret",
		}, result)
		// Verify camelCase keys are not present
		assert.NotContains(t, result, "orgMapping")
		assert.NotContains(t, result, "orgAttributePath")
		assert.NotContains(t, result, "clientId")
		assert.NotContains(t, result, "clientSecret")
	})

	t.Run("preserves existing snake_case keys", func(t *testing.T) {
		input := map[string]any{
			"org_mapping":        "org-a-Admin:OrgA:Admin",
			"org_attribute_path": "grafana_orgs",
		}

		result := NormalizeSettings(input)

		assert.Equal(t, input, result)
	})

	t.Run("resolves camelCase non-empty when snake_case is empty string", func(t *testing.T) {
		input := map[string]any{
			"org_mapping":        "",
			"orgMapping":         "org-a-Admin:OrgA:Admin",
			"org_attribute_path": "",
			"orgAttributePath":   "grafana_orgs",
		}

		result := NormalizeSettings(input)

		assert.Equal(t, "org-a-Admin:OrgA:Admin", result["org_mapping"])
		assert.Equal(t, "grafana_orgs", result["org_attribute_path"])
		assert.NotContains(t, result, "orgMapping")
		assert.NotContains(t, result, "orgAttributePath")
	})

	t.Run("resolves snake_case non-empty when camelCase is empty string", func(t *testing.T) {
		input := map[string]any{
			"org_mapping":        "org-a-Admin:OrgA:Admin",
			"orgMapping":         "",
			"org_attribute_path": "grafana_orgs",
			"orgAttributePath":   "",
		}

		result := NormalizeSettings(input)

		assert.Equal(t, "org-a-Admin:OrgA:Admin", result["org_mapping"])
		assert.Equal(t, "grafana_orgs", result["org_attribute_path"])
		assert.NotContains(t, result, "orgMapping")
		assert.NotContains(t, result, "orgAttributePath")
	})
}

func TestSSOSettings_JSON_Consistency(t *testing.T) {
	t.Run("repeated MarshalJSON produces deterministic camelCase without alternating", func(t *testing.T) {
		// Simulates the corrupted DB record where both snake_case and camelCase keys coexist
		settings := SSOSettings{
			Provider: "generic_oauth",
			Settings: map[string]any{
				"org_mapping":        "",
				"orgMapping":         "org-a-Admin:OrgA:Admin",
				"org_attribute_path": "grafana_orgs",
				"orgAttributePath":   "grafana_orgs",
			},
		}

		for i := 0; i < 50; i++ {
			data, err := json.Marshal(settings)
			require.NoError(t, err)

			var unmarshaled struct {
				Provider string         `json:"provider"`
				Settings map[string]any `json:"settings"`
			}
			err = json.Unmarshal(data, &unmarshaled)
			require.NoError(t, err)

			assert.Equal(t, "org-a-Admin:OrgA:Admin", unmarshaled.Settings["orgMapping"])
			assert.Equal(t, "grafana_orgs", unmarshaled.Settings["orgAttributePath"])
			assert.NotContains(t, unmarshaled.Settings, "org_mapping")
			assert.NotContains(t, unmarshaled.Settings, "org_attribute_path")
		}
	})

	t.Run("UnmarshalJSON normalizes camelCase keys to snake_case", func(t *testing.T) {
		raw := `{"provider":"generic_oauth","settings":{"orgMapping":"org-a-Admin:OrgA:Admin","orgAttributePath":"grafana_orgs"}}`
		var settings SSOSettings
		err := json.Unmarshal([]byte(raw), &settings)
		require.NoError(t, err)

		assert.Equal(t, "org-a-Admin:OrgA:Admin", settings.Settings["org_mapping"])
		assert.Equal(t, "grafana_orgs", settings.Settings["org_attribute_path"])
		assert.NotContains(t, settings.Settings, "orgMapping")
		assert.NotContains(t, settings.Settings, "orgAttributePath")
	})
}

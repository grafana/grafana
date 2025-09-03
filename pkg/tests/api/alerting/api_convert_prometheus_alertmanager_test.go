package alerting

import (
	"net/http"
	"path"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestIntegrationConvertPrometheusAlertmanagerEndpoints(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
		// Setup Grafana with alerting import feature flag enabled
	}
	testinfra.SQLiteIntegrationTest(t)

	dir, gpath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingImportAlertmanagerAPI,
		},
	})

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, gpath)

	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	configYaml, err := testData.ReadFile(path.Join("test-data", "mimir-alertmanager-post.yaml"))
	require.NoError(t, err)
	template, err := testData.ReadFile(path.Join("test-data", "mimir-alertmanager.tmpl"))
	require.NoError(t, err)
	expected, err := testData.ReadFile(path.Join("test-data", "mimir-alertmanager-get.yaml"))
	require.NoError(t, err)
	var expectedConfig map[string]any
	require.NoError(t, yaml.Unmarshal(expected, &expectedConfig))

	cleanup := func(identifier string) {
		deleteHeaders := map[string]string{
			"X-Grafana-Alerting-Config-Identifier": identifier,
		}
		_, status, _ := apiClient.RawConvertPrometheusDeleteAlertmanagerConfig(t, deleteHeaders)
		require.Equal(t, http.StatusAccepted, status)
	}

	t.Run("create and get alertmanager configuration", func(t *testing.T) {
		identifier := "test-create-get-config"
		defer cleanup(identifier)
		mergeMatchers := "environment=production,team=backend"

		headers := map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": identifier,
			"X-Grafana-Alerting-Merge-Matchers":    mergeMatchers,
		}

		amConfig := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: string(configYaml),
			TemplateFiles: map[string]string{
				"mimir-alertmanager.tmpl": string(template),
			},
		}

		response := apiClient.ConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
		require.Equal(t, "success", response.Status)

		getHeaders := map[string]string{
			"X-Grafana-Alerting-Config-Identifier": identifier,
		}
		retrievedConfig := apiClient.ConvertPrometheusGetAlertmanagerConfig(t, getHeaders)
		var actualConfig map[string]any
		require.NoError(t, yaml.Unmarshal([]byte(retrievedConfig.AlertmanagerConfig), &actualConfig))

		diff := cmp.Diff(expectedConfig, actualConfig)
		if diff != "" {
			t.Fatalf("unexpected config (-want +got):\n%s", diff)
		}
		require.Contains(t, retrievedConfig.TemplateFiles, "mimir-alertmanager.tmpl")
		require.Equal(t, string(template), retrievedConfig.TemplateFiles["mimir-alertmanager.tmpl"])
	})

	t.Run("delete alertmanager configuration", func(t *testing.T) {
		identifier := "test-delete-config"
		defer cleanup(identifier)
		mergeMatchers := "environment=production,team=backend"

		headers := map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": identifier,
			"X-Grafana-Alerting-Merge-Matchers":    mergeMatchers,
		}

		amConfig := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: string(configYaml),
			TemplateFiles: map[string]string{
				"mimir-alertmanager.tmpl": string(template),
			},
		}

		response := apiClient.ConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
		require.Equal(t, "success", response.Status)

		deleteHeaders := map[string]string{
			"X-Grafana-Alerting-Config-Identifier": identifier,
		}
		apiClient.ConvertPrometheusDeleteAlertmanagerConfig(t, deleteHeaders)

		// Verify configuration is deleted by trying to get it again
		getHeaders := map[string]string{
			"X-Grafana-Alerting-Config-Identifier": identifier,
		}
		_, status, _ := apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, getHeaders)
		requireStatusCode(t, http.StatusNotFound, status, "")
	})

	t.Run("error cases", func(t *testing.T) {
		t.Run("POST without config identifier header should use default identifier", func(t *testing.T) {
			defer cleanup("")

			headers := map[string]string{
				"Content-Type":                      "application/yaml",
				"X-Grafana-Alerting-Merge-Matchers": "environment=test",
			}

			amConfig := apimodels.AlertmanagerUserConfig{
				AlertmanagerConfig: string(configYaml),
			}

			_, status, _ := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
			requireStatusCode(t, http.StatusAccepted, status, "")

			getHeaders := map[string]string{
				"X-Grafana-Alerting-Config-Identifier": "default",
			}
			responseConfig, status, _ := apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, getHeaders)
			requireStatusCode(t, http.StatusOK, status, "")
			require.NotEmpty(t, responseConfig.AlertmanagerConfig)
		})

		t.Run("POST without merge matchers header should fail", func(t *testing.T) {
			headers := map[string]string{
				"Content-Type":                         "application/yaml",
				"X-Grafana-Alerting-Config-Identifier": "test-config",
			}

			amConfig := apimodels.AlertmanagerUserConfig{
				AlertmanagerConfig: string(configYaml),
			}

			_, status, _ := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
			requireStatusCode(t, http.StatusBadRequest, status, "")
		})

		t.Run("POST with invalid merge matchers format should fail", func(t *testing.T) {
			headers := map[string]string{
				"Content-Type":                         "application/yaml",
				"X-Grafana-Alerting-Config-Identifier": "test-invalid-matchers",
				"X-Grafana-Alerting-Merge-Matchers":    "invalid-no-equals-sign",
			}

			amConfig := apimodels.AlertmanagerUserConfig{
				AlertmanagerConfig: string(configYaml),
			}

			_, status, _ := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
			requireStatusCode(t, http.StatusBadRequest, status, "")
		})

		t.Run("POST with invalid alertmanager configuration should fail", func(t *testing.T) {
			headers := map[string]string{
				"Content-Type":                         "application/yaml",
				"X-Grafana-Alerting-Config-Identifier": "test-invalid-yaml",
				"X-Grafana-Alerting-Merge-Matchers":    "environment=test",
			}

			amConfig := apimodels.AlertmanagerUserConfig{
				AlertmanagerConfig: `invalid yaml: [[[`,
			}

			_, status, _ := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
			requireStatusCode(t, http.StatusBadRequest, status, "")
		})

		t.Run("DELETE without config identifier header should use default identifier", func(t *testing.T) {
			createHeaders := map[string]string{
				"Content-Type":                      "application/yaml",
				"X-Grafana-Alerting-Merge-Matchers": "environment=test",
			}

			amConfig := apimodels.AlertmanagerUserConfig{
				AlertmanagerConfig: string(configYaml),
			}

			_, status, _ := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, createHeaders)
			requireStatusCode(t, http.StatusAccepted, status, "")

			_, status, _ = apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, nil)
			requireStatusCode(t, http.StatusOK, status, "")

			_, status, _ = apiClient.RawConvertPrometheusDeleteAlertmanagerConfig(t, nil)
			requireStatusCode(t, http.StatusAccepted, status, "")

			_, status, _ = apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, nil)
			requireStatusCode(t, http.StatusNotFound, status, "")
		})
	})

	t.Run("update existing configuration", func(t *testing.T) {
		identifier := "test-update-config"
		defer cleanup(identifier)

		headers := map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": identifier,
			"X-Grafana-Alerting-Merge-Matchers":    "environment=production",
		}

		amConfig1 := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: string(configYaml),
			TemplateFiles: map[string]string{
				"config1.tmpl": `{{ define "config1.template" }}Config 1{{ end }}`,
			},
		}

		response1 := apiClient.ConvertPrometheusPostAlertmanagerConfig(t, amConfig1, headers)
		require.Equal(t, "success", response1.Status)

		// Update the same configuration with new content
		updatedConfigYAML := `
route:
  group_by: ['service']
  group_wait: 5s
  group_interval: 5s
  repeat_interval: 30m
  receiver: updated-webhook

receivers:
- name: updated-webhook
  webhook_configs:
  - url: 'http://127.0.0.1:8080/updated'
`

		amConfig2 := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: updatedConfigYAML,
			TemplateFiles: map[string]string{
				"updated.tmpl": `{{ define "updated.template" }}Updated Config{{ end }}`,
			},
		}

		response2 := apiClient.ConvertPrometheusPostAlertmanagerConfig(t, amConfig2, headers)
		require.Equal(t, "success", response2.Status)

		// Verify the updated configuration is retrieved
		getHeaders := map[string]string{
			"X-Grafana-Alerting-Config-Identifier": identifier,
		}
		retrievedConfig := apiClient.ConvertPrometheusGetAlertmanagerConfig(t, getHeaders)

		require.NotEmpty(t, retrievedConfig.AlertmanagerConfig)
		require.Contains(t, retrievedConfig.AlertmanagerConfig, "name: updated-webhook")
		require.Contains(t, retrievedConfig.AlertmanagerConfig, "receiver: updated-webhook")
		require.Contains(t, retrievedConfig.AlertmanagerConfig, "webhook_configs:")

		require.Equal(t, `{{ define "updated.template" }}Updated Config{{ end }}`, retrievedConfig.TemplateFiles["updated.tmpl"])
	})

	t.Run("multiple extra configurations conflict", func(t *testing.T) {
		firstIdentifier := "first-config"
		secondIdentifier := "second-config"
		defer cleanup(firstIdentifier)

		// Create first configuration
		firstHeaders := map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": firstIdentifier,
			"X-Grafana-Alerting-Merge-Matchers":    "environment=first",
		}

		amConfig1 := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: string(configYaml),
			TemplateFiles: map[string]string{
				"first.tmpl": `{{ define "first.template" }}First Config{{ end }}`,
			},
		}

		response1 := apiClient.ConvertPrometheusPostAlertmanagerConfig(t, amConfig1, firstHeaders)
		require.Equal(t, "success", response1.Status)

		// Try to create second configuration with different identifier,
		// it should fail because we don't support this yet.
		secondHeaders := map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": secondIdentifier,
			"X-Grafana-Alerting-Merge-Matchers":    "environment=second",
		}

		amConfig2 := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: `
global:
  smtp_smarthost: localhost:25

route:
  group_by: ['service']
  receiver: second.hook

receivers:
- name: second.hook
  webhook_configs:
  - url: 'http://127.0.0.1:8080/second'
`,
			TemplateFiles: map[string]string{
				"second.tmpl": `{{ define "second.template" }}Second Config{{ end }}`,
			},
		}

		_, status, body := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig2, secondHeaders)
		requireStatusCode(t, http.StatusConflict, status, "")
		require.Contains(t, body, "multiple extra configurations are not supported")
		require.Contains(t, body, firstIdentifier)
	})
}

func TestIntegrationConvertPrometheusAlertmanagerEndpoints_FeatureFlagDisabled(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	testinfra.SQLiteIntegrationTest(t)

	dir, gpath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, gpath)
	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	headers := map[string]string{
		"Content-Type":                         "application/yaml",
		"X-Grafana-Alerting-Config-Identifier": "test-config",
		"X-Grafana-Alerting-Merge-Matchers":    "environment=test",
	}
	configYaml, err := testData.ReadFile(path.Join("test-data", "mimir-alertmanager-post.yaml"))
	require.NoError(t, err)

	t.Run("POST should return not implemented when feature flag disabled", func(t *testing.T) {
		amConfig := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: string(configYaml),
		}

		_, status, _ := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
		requireStatusCode(t, http.StatusNotImplemented, status, "")
	})

	t.Run("GET should return not implemented when feature flag disabled", func(t *testing.T) {
		_, status, _ := apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, headers)
		requireStatusCode(t, http.StatusNotImplemented, status, "")
	})

	t.Run("DELETE should return not implemented when feature flag disabled", func(t *testing.T) {
		_, status, _ := apiClient.RawConvertPrometheusDeleteAlertmanagerConfig(t, headers)
		requireStatusCode(t, http.StatusNotImplemented, status, "")
	})
}

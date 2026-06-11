package alerting

import (
	"encoding/json"
	"net/http"
	"path"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/alerting/receivers/opsgenie"
	opsgeniev1 "github.com/grafana/alerting/receivers/opsgenie/v1"
	"github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationConvertPrometheusAlertmanagerEndpoints(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Setup Grafana with alerting import feature flag enabled

	testinfra.SQLiteIntegrationTest(t)

	dir, gpath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingMultiplePolicies,
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

	apiClient.EnsureMuteTiming(t, apimodels.MuteTimeInterval{MuteTimeInterval: config.MuteTimeInterval{Name: "maintenance_window"}})
	apiClient.EnsureReceiver(t, apimodels.EmbeddedContactPoint{Name: "opsgenie", Type: string(opsgenie.Type), Settings: simplejson.MustJson([]byte(opsgeniev1.FullValidConfigForTesting))})

	t.Run("create and get alertmanager configuration", func(t *testing.T) {
		identifier := "test-create-get-config"
		defer cleanup(identifier)

		headers := map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": identifier,
		}

		amConfig := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: string(configYaml),
			TemplateFiles: map[string]string{
				"mimir-alertmanager.tmpl": string(template),
			},
		}

		response := apiClient.ConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
		require.Equal(t, "success", response.Status)

		t.Run("should return renamed resources", func(t *testing.T) {
			assert.Contains(t, response.RenameResources.Receivers, "opsgenie")
			assert.Contains(t, response.RenameResources.TimeIntervals, "maintenance_window")
		})

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

		headers := map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": identifier,
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
				"Content-Type": "application/yaml",
			}

			amConfig := apimodels.AlertmanagerUserConfig{
				AlertmanagerConfig: string(configYaml),
			}

			_, status, _ := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
			requireStatusCode(t, http.StatusAccepted, status, "")

			getHeaders := map[string]string{
				"X-Grafana-Alerting-Config-Identifier": "imported",
			}
			responseConfig, status, _ := apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, getHeaders)
			requireStatusCode(t, http.StatusOK, status, "")
			require.NotEmpty(t, responseConfig.AlertmanagerConfig)
		})

		t.Run("POST with invalid identifier should fail", func(t *testing.T) {
			headers := map[string]string{
				"Content-Type":                         "application/yaml",
				"X-Grafana-Alerting-Config-Identifier": "-test-",
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
			}

			amConfig := apimodels.AlertmanagerUserConfig{
				AlertmanagerConfig: `invalid yaml: [[[`,
			}

			_, status, _ := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
			requireStatusCode(t, http.StatusBadRequest, status, "")
		})

		t.Run("POST with unsupported receiver fields should fail", func(t *testing.T) {
			headers := map[string]string{
				"Content-Type":                         "application/yaml",
				"X-Grafana-Alerting-Config-Identifier": "test-unsupported-fields",
			}

			// auth_password_file references the filesystem, which Grafana's
			// Alertmanager cannot represent; the import must be rejected rather
			// than silently dropping it.
			amConfig := apimodels.AlertmanagerUserConfig{
				AlertmanagerConfig: `
global:
  smtp_smarthost: 'localhost:25'
  smtp_from: 'alerts@example.com'
route:
  receiver: a
receivers:
  - name: a
    email_configs:
      - to: someone@example.com
        auth_password_file: /etc/smtp-password
`,
			}

			_, status, body := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
			requireStatusCode(t, http.StatusBadRequest, status, body)
			require.Contains(t, body, "alerting.unsupportedReceiverFields")
			require.Contains(t, body, "email_configs[0].auth_password_file")

			// The rejected config must not have been stored.
			_, status, _ = apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, map[string]string{
				"X-Grafana-Alerting-Config-Identifier": "test-unsupported-fields",
			})
			requireStatusCode(t, http.StatusNotFound, status, "")
		})

		t.Run("DELETE without config identifier header should use default identifier", func(t *testing.T) {
			createHeaders := map[string]string{
				"Content-Type": "application/yaml",
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

		// Create first configuration
		firstHeaders := map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": firstIdentifier,
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

		t.Run("should override existing configuration if specified", func(t *testing.T) {
			defer cleanup(secondIdentifier)
			secondHeaders["X-Grafana-Alerting-Config-Force-Replace"] = "true"

			response2 := apiClient.ConvertPrometheusPostAlertmanagerConfig(t, amConfig2, secondHeaders)
			require.Equal(t, "success", response2.Status)

			getHeaders := map[string]string{
				"X-Grafana-Alerting-Config-Identifier": firstIdentifier,
			}

			_, status, _ := apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, getHeaders)
			requireStatusCode(t, http.StatusNotFound, status, "")

			getHeaders = map[string]string{
				"X-Grafana-Alerting-Config-Identifier": secondIdentifier,
			}

			_, status, _ = apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, getHeaders)
			requireStatusCode(t, http.StatusOK, status, "")
		})
	})

	t.Run("promote imports configuration into main Grafana config", func(t *testing.T) {
		identifier := "test-promote-main"

		amConfig := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: `
route:
  receiver: promoted-webhook
receivers:
  - name: promoted-webhook
    webhook_configs:
      - url: 'http://127.0.0.1:8080/webhook'
`,
			TemplateFiles: map[string]string{
				"promoted.tmpl": `{{ define "promoted" }}Promoted{{ end }}`,
			},
		}

		rawResp, status, _ := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": identifier,
			"X-Grafana-Alerting-Promote":           "true",
		})
		requireStatusCode(t, http.StatusAccepted, status, "")
		require.Equal(t, "success", rawResp.Status)
		require.NotNil(t, rawResp.Stats)
		require.Equal(t, identifier, rawResp.Stats.AddedRoute)
		require.Contains(t, rawResp.Stats.AddedReceivers, "promoted-webhook")
		require.Contains(t, rawResp.Stats.AddedTemplates, "promoted.tmpl")

		// Promoted config must not be stored in ExtraConfigs.
		_, status, _ = apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, map[string]string{
			"X-Grafana-Alerting-Config-Identifier": identifier,
		})
		requireStatusCode(t, http.StatusNotFound, status, "")

		// Promoted receiver and template must appear in the main Grafana alertmanager config.
		mainConfig, status, _ := apiClient.GetAlertmanagerConfigWithStatus(t)
		requireStatusCode(t, http.StatusOK, status, "")
		require.Empty(t, mainConfig.ExtraConfigs)
		var receiverNames []string
		for _, r := range mainConfig.AlertmanagerConfig.Receivers {
			receiverNames = append(receiverNames, r.Name)
		}
		require.Contains(t, receiverNames, "promoted-webhook")
		require.Contains(t, mainConfig.TemplateFiles, "promoted.tmpl")

		// Promoted template must be accessible via the provisioning templates API with no provenance —
		// meaning it is not locked and can be edited through regular APIs.
		templates, status, _ := apiClient.GetTemplatesWithStatus(t)
		requireStatusCode(t, http.StatusOK, status, "")
		var found *apimodels.NotificationTemplate
		for i := range templates {
			if templates[i].Name == "promoted.tmpl" {
				found = &templates[i]
				break
			}
		}
		require.NotNil(t, found, "promoted.tmpl must appear in the provisioning templates API")
		require.Empty(t, found.Provenance, "promoted template must have no provenance (not locked)")
	})

	t.Run("dry-run with promote validates but does not save", func(t *testing.T) {
		identifier := "test-dryrun-promote"

		amConfig := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: `
route:
  receiver: dryrun-promote-receiver
receivers:
  - name: dryrun-promote-receiver
    webhook_configs:
      - url: 'http://127.0.0.1:8080/dryrun'
`,
		}

		_, status, body := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": identifier,
			"X-Grafana-Alerting-Dry-Run":           "true",
			"X-Grafana-Alerting-Promote":           "true",
		})
		requireStatusCode(t, http.StatusOK, status, body) // dry-run returns 200
		rawResp := apimodels.ConvertAlertmanagerResponse{}
		require.NoError(t, json.Unmarshal([]byte(body), &rawResp))
		require.Equal(t, "success", rawResp.Status)
		require.NotNil(t, rawResp.Stats)
		require.Equal(t, identifier, rawResp.Stats.AddedRoute)
		require.Contains(t, rawResp.Stats.AddedReceivers, "dryrun-promote-receiver")

		// Nothing must be saved — neither in ExtraConfigs nor in the main config.
		_, status, _ = apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, map[string]string{
			"X-Grafana-Alerting-Config-Identifier": identifier,
		})
		requireStatusCode(t, http.StatusNotFound, status, "")

		mainConfig, status, _ := apiClient.GetAlertmanagerConfigWithStatus(t)
		requireStatusCode(t, http.StatusOK, status, "")
		var receiverNames []string
		for _, r := range mainConfig.AlertmanagerConfig.Receivers {
			receiverNames = append(receiverNames, r.Name)
		}
		require.NotContains(t, receiverNames, "dryrun-promote-receiver")
	})

	t.Run("promote blocks re-import with same identifier", func(t *testing.T) {
		identifier := "test-promote-reimport"

		amConfig := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: `
route:
  receiver: reimport-receiver
receivers:
  - name: reimport-receiver
    webhook_configs:
      - url: 'http://127.0.0.1:8080/reimport'
`,
		}
		headers := map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": identifier,
			"X-Grafana-Alerting-Promote":           "true",
		}

		_, status, _ := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
		requireStatusCode(t, http.StatusAccepted, status, "")

		// Re-importing with the same identifier must fail: the identifier is now locked in ManagedRoutes.
		_, status, body := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
		requireStatusCode(t, http.StatusBadRequest, status, body)
	})

	t.Run("promote with replace removes pre-existing ExtraConfig", func(t *testing.T) {
		identifierA := "test-promote-replace-a"
		identifierB := "test-promote-replace-b"

		// Step 1: import config A without promote.
		_, status, _ := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: `
route:
  receiver: replace-a-receiver
receivers:
  - name: replace-a-receiver
    webhook_configs:
      - url: 'http://127.0.0.1:8080/a'
`,
		}, map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": identifierA,
		})
		requireStatusCode(t, http.StatusAccepted, status, "")

		// Verify A is in ExtraConfigs.
		_, status, _ = apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, map[string]string{
			"X-Grafana-Alerting-Config-Identifier": identifierA,
		})
		requireStatusCode(t, http.StatusOK, status, "")

		// Step 2: import config B with promote=true and replace=true.
		rawResp, status, _ := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: `
route:
  receiver: replace-b-receiver
receivers:
  - name: replace-b-receiver
    webhook_configs:
      - url: 'http://127.0.0.1:8080/b'
`,
		}, map[string]string{
			"Content-Type":                            "application/yaml",
			"X-Grafana-Alerting-Config-Identifier":    identifierB,
			"X-Grafana-Alerting-Promote":              "true",
			"X-Grafana-Alerting-Config-Force-Replace": "true",
		})
		requireStatusCode(t, http.StatusAccepted, status, "")
		require.Equal(t, identifierB, rawResp.Stats.AddedRoute)

		// Config A must be gone from ExtraConfigs (replaced and promoted away).
		_, status, _ = apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, map[string]string{
			"X-Grafana-Alerting-Config-Identifier": identifierA,
		})
		requireStatusCode(t, http.StatusNotFound, status, "")

		// Config B is promoted, so it must not be in ExtraConfigs either.
		_, status, _ = apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, map[string]string{
			"X-Grafana-Alerting-Config-Identifier": identifierB,
		})
		requireStatusCode(t, http.StatusNotFound, status, "")

		// B's receiver must be in the main config; A's must not.
		mainConfig, status, _ := apiClient.GetAlertmanagerConfigWithStatus(t)
		requireStatusCode(t, http.StatusOK, status, "")
		require.Empty(t, mainConfig.ExtraConfigs)
		var receiverNames []string
		for _, r := range mainConfig.AlertmanagerConfig.Receivers {
			receiverNames = append(receiverNames, r.Name)
		}
		require.Contains(t, receiverNames, "replace-b-receiver")
		require.NotContains(t, receiverNames, "replace-a-receiver")
	})

	t.Run("promote preserves rename result when receiver conflicts with existing", func(t *testing.T) {
		identifier := "test-promote-rename"

		// Import a config with a receiver named "opsgenie", which conflicts with the
		// pre-existing receiver created by EnsureReceiver at the top of this test.
		rawResp, status, _ := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: `
route:
  receiver: opsgenie
receivers:
  - name: opsgenie
    webhook_configs:
      - url: 'http://127.0.0.1:8080/opsgenie'
`,
		}, map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": identifier,
			"X-Grafana-Alerting-Promote":           "true",
		})
		requireStatusCode(t, http.StatusAccepted, status, "")
		require.Equal(t, "success", rawResp.Status)
		require.NotNil(t, rawResp.RenameResources, "conflicting receiver must produce a rename result")
		require.Contains(t, rawResp.RenameResources.Receivers, "opsgenie")

		renamedName := rawResp.RenameResources.Receivers["opsgenie"]
		require.NotEmpty(t, renamedName)

		// The renamed receiver must appear in the main config under its new name.
		mainConfig, status, _ := apiClient.GetAlertmanagerConfigWithStatus(t)
		requireStatusCode(t, http.StatusOK, status, "")
		var receiverNames []string
		for _, r := range mainConfig.AlertmanagerConfig.Receivers {
			receiverNames = append(receiverNames, r.Name)
		}
		require.Contains(t, receiverNames, renamedName)
	})

	t.Run("dry-run should not create configuration", func(t *testing.T) {
		identifier := "config"
		// Create first configuration
		firstHeaders := map[string]string{
			"Content-Type":                         "application/yaml",
			"X-Grafana-Alerting-Config-Identifier": identifier,
			"X-Grafana-Alerting-Dry-Run":           "true",
		}

		amConfig := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: string(configYaml),
			TemplateFiles: map[string]string{
				"first.tmpl": `{{ define "first.template" }}First Config{{ end }}`,
			},
		}

		_, status, body := apiClient.RawConvertPrometheusPostAlertmanagerConfig(t, amConfig, firstHeaders)
		require.Equal(t, http.StatusOK, status)

		response := apimodels.ConvertAlertmanagerResponse{}
		err := json.Unmarshal([]byte(body), &response)
		require.NoError(t, err)

		t.Run("should return renamed resources", func(t *testing.T) {
			assert.Contains(t, response.RenameResources.Receivers, "opsgenie")
			assert.Contains(t, response.RenameResources.TimeIntervals, "maintenance_window")
		})

		_, status, _ = apiClient.RawConvertPrometheusGetAlertmanagerConfig(t, firstHeaders)
		requireStatusCode(t, http.StatusNotFound, status, "")
	})
}

func TestIntegrationConvertPrometheusAlertmanagerEndpoints_FeatureFlagDisabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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

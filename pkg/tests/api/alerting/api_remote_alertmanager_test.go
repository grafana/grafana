package alerting

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/tests/alertmanager"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// TestIntegrationRemoteAlertmanagerConfigUpload tests that when we post an alertmanager
// configuration to Grafana with remote alertmanager enabled, it gets uploaded to the remote Mimir.
func TestIntegrationRemoteAlertmanagerConfigUpload(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	s, err := alertmanager.NewAlertmanagerScenario()
	require.NoError(t, err)
	defer s.Close()

	s.Mimir = alertmanager.NewMimirService("mimir")
	require.NoError(t, s.StartAndWaitReady(s.Mimir))

	mimirEndpoint := "http://" + s.Mimir.HTTPEndpoint()

	dir, gpath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
		EnableFeatureToggles: []string{
			"alertmanagerRemotePrimary",
			"alertingImportAlertmanagerAPI",
		},
		RemoteAlertmanagerURL: mimirEndpoint,
	})

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, gpath)

	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")
	mimirClient, err := alertmanager.NewMimirClient(mimirEndpoint, "1")
	require.NoError(t, err)

	// Wait for Grafana to be ready
	require.Eventually(t, func() bool {
		_, status, _ := apiClient.GetAlertmanagerConfigWithStatus(t)
		return status == http.StatusOK
	}, 30*time.Second, time.Second, "Grafana failed to start")

	// Check that the initial Mimir config contains the default Grafana configuration
	initialMimirConfig, err := mimirClient.GetGrafanaAlertmanagerConfig(context.Background())
	require.NoError(t, err)
	require.NotEmpty(t, initialMimirConfig) // Grafana automatically syncs default config to remote alertmanager

	// Initially there is just the default grafana-default-email receiver
	config := initialMimirConfig["data"].(map[string]any)["configuration"].(map[string]any)
	alertmanagerConfig := config["alertmanager_config"].(map[string]any)
	receivers := alertmanagerConfig["receivers"].([]any)
	require.Len(t, receivers, 1)
	defaultReceiver := receivers[0].(map[string]any)
	require.Equal(t, "grafana-default-email", defaultReceiver["name"])

	// Now upload a new extra config and check that it gets uploaded to Mimir
	testAlertmanagerConfigYAML := `
route:
  group_by: ['alertname'] 
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: test-webhook

receivers:
- name: test-webhook
  webhook_configs:
  - url: 'http://127.0.0.1:5001/test'
`

	headers := map[string]string{
		"Content-Type":                         "application/yaml",
		"X-Grafana-Alerting-Config-Identifier": "external-system",
		"X-Grafana-Alerting-Merge-Matchers":    "environment=production,team=backend",
	}

	amConfig := apimodels.AlertmanagerUserConfig{
		AlertmanagerConfig: testAlertmanagerConfigYAML,
		TemplateFiles: map[string]string{
			"test.tmpl": `{{ define "test.template" }}Test template for remote sync{{ end }}`,
		},
	}

	// Post the configuration to Grafana
	response := apiClient.ConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
	require.Equal(t, "success", response.Status)

	_, status, _ := apiClient.GetAlertmanagerConfigWithStatus(t)
	require.Equal(t, http.StatusOK, status)

	// Check that the configuration was successfully sent to Mimir and contains the new receiver
	finalMimirConfig, err := mimirClient.GetGrafanaAlertmanagerConfig(context.Background())
	require.NoError(t, err)
	require.NotEmpty(t, finalMimirConfig)
	cfg := finalMimirConfig["data"].(map[string]any)["configuration"].(map[string]any)
	receivers = cfg["alertmanager_config"].(map[string]any)["receivers"].([]any)

	require.ElementsMatch(t, receivers, []any{
		map[string]any{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": []any{
				map[string]any{
					"disableResolveMessage": false,
					"name":                  "email receiver",
					"settings": map[string]any{
						"addresses": "<example@email.com>",
					},
					"type": "email",
					"uid":  "",
				},
			},
		},
		map[string]any{
			"name": "test-webhook",
			"webhook_configs": []any{
				map[string]any{
					"http_config": map[string]any{
						"enable_http2":     true,
						"follow_redirects": true,
						"proxy_url":        nil,
						"tls_config": map[string]any{
							"insecure_skip_verify": false,
						},
					},
					"max_alerts":    float64(0),
					"send_resolved": true,
					"timeout":       float64(0),
					"url":           "<secret>",
					"url_file":      "",
				},
			},
		},
	})
}

// TestIntegrationRemoteAlertmanagerHistoricalConfigActivation tests that when we activate
// a historical alertmanager configuration with extra configs, it gets properly decrypted
// and uploaded to the remote Mimir.
func TestIntegrationRemoteAlertmanagerHistoricalConfigActivation(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	s, err := alertmanager.NewAlertmanagerScenario()
	require.NoError(t, err)
	defer s.Close()

	s.Mimir = alertmanager.NewMimirService("mimir")
	require.NoError(t, s.StartAndWaitReady(s.Mimir))

	mimirEndpoint := "http://" + s.Mimir.HTTPEndpoint()

	dir, gpath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
		EnableFeatureToggles: []string{
			"alertmanagerRemotePrimary",
			"alertingImportAlertmanagerAPI",
		},
		RemoteAlertmanagerURL: mimirEndpoint,
	})

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, gpath)

	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")
	mimirClient, err := alertmanager.NewMimirClient(mimirEndpoint, "1")
	require.NoError(t, err)

	require.Eventually(t, func() bool {
		_, status, _ := apiClient.GetAlertmanagerConfigWithStatus(t)
		return status == http.StatusOK
	}, 30*time.Second, time.Second, "Grafana failed to start")

	// Upload configuration with extra configs
	testAlertmanagerConfigYAML := `
route:
  group_by: ['alertname'] 
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: historical-webhook

receivers:
- name: historical-webhook
  webhook_configs:
  - url: 'http://127.0.0.1:5002/historical'
`

	headers := map[string]string{
		"Content-Type":                         "application/yaml",
		"X-Grafana-Alerting-Config-Identifier": "historical-system",
		"X-Grafana-Alerting-Merge-Matchers":    "environment=test,team=platform",
	}

	amConfig := apimodels.AlertmanagerUserConfig{
		AlertmanagerConfig: testAlertmanagerConfigYAML,
		TemplateFiles: map[string]string{
			"historical.tmpl": `{{ define "historical.template" }}Historical template{{ end }}`,
		},
	}

	response := apiClient.ConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
	require.Equal(t, "success", response.Status)

	// Get the configuration history to find the most recent config
	historyResponse := getAlertmanagerConfigHistory(t, apiClient)
	require.NotEmpty(t, historyResponse)

	var mostRecentID int64
	for _, entry := range historyResponse {
		if entry.ID > mostRecentID {
			mostRecentID = entry.ID
		}
	}
	require.Greater(t, mostRecentID, int64(0), "Should have found a historical configuration")

	// Activate the historical configuration
	activateHistoricalConfiguration(t, apiClient, mostRecentID)

	// Verify the configuration
	finalMimirConfig, err := mimirClient.GetGrafanaAlertmanagerConfig(context.Background())
	require.NoError(t, err)
	require.NotEmpty(t, finalMimirConfig)

	cfg := finalMimirConfig["data"].(map[string]any)["configuration"].(map[string]any)
	receivers := cfg["alertmanager_config"].(map[string]any)["receivers"].([]any)

	require.Len(t, receivers, 2)

	found := false
	for _, rcv := range receivers {
		receiver := rcv.(map[string]any)
		if receiver["name"] == "historical-webhook" {
			found = true
			webhookConfigs := receiver["webhook_configs"].([]any)
			require.Len(t, webhookConfigs, 1)
			break
		}
	}
	require.True(t, found)
}

func getAlertmanagerConfigHistory(t *testing.T, client apiClient) []apimodels.GettableHistoricUserConfig {
	t.Helper()
	u, err := url.Parse(fmt.Sprintf("%s/api/alertmanager/grafana/config/history", client.url))
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	require.NoError(t, err)

	history, _, _ := sendRequestJSON[[]apimodels.GettableHistoricUserConfig](t, req, http.StatusOK)
	return history
}

func activateHistoricalConfiguration(t *testing.T, client apiClient, configID int64) {
	t.Helper()
	u, err := url.Parse(fmt.Sprintf("%s/api/alertmanager/grafana/config/history/%d/_activate", client.url, configID))
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodPost, u.String(), nil)
	require.NoError(t, err)

	response, statusCode, body := sendRequestJSON[map[string]string](t, req, http.StatusAccepted)
	if statusCode != http.StatusAccepted {
		t.Fatalf("Expected status code %d but got %d. Response body: %s", http.StatusAccepted, statusCode, body)
	}
	require.Equal(t, "configuration activated", response["message"])
}

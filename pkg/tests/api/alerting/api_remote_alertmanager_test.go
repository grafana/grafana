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
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
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
	require.NotNil(t, initialMimirConfig) // Grafana automatically syncs default config to remote alertmanager
	require.NotNil(t, initialMimirConfig.GrafanaAlertmanagerConfig)

	// Initially there is just the default grafana-default-email receiver
	receivers := initialMimirConfig.GrafanaAlertmanagerConfig.AlertmanagerConfig.Receivers
	require.Len(t, receivers, 1)
	require.Equal(t, "grafana-default-email", receivers[0].Name)

	// Now upload a new extra config and check that it gets uploaded to Mimir
	testAlertmanagerConfigYAML := `
route:
  group_by: ['alertname'] 
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: extra-slack

receivers:
- name: extra-slack
  slack_configs:
  - api_url: 'http://localhost/slack'
    channel: '#alerts'
    title: 'Alerts'
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
	require.NotNil(t, finalMimirConfig)
	require.NotNil(t, finalMimirConfig.GrafanaAlertmanagerConfig)

	receivers = finalMimirConfig.GrafanaAlertmanagerConfig.AlertmanagerConfig.Receivers
	require.Len(t, receivers, 2)

	var foundDefault, foundExtraSlack bool
	for _, receiver := range receivers {
		switch receiver.Name {
		case "grafana-default-email":
			foundDefault = true
			require.Len(t, receiver.GrafanaManagedReceivers, 1)
			require.Equal(t, "email receiver", receiver.GrafanaManagedReceivers[0].Name)
			require.Equal(t, "email", receiver.GrafanaManagedReceivers[0].Type)
		case "extra-slack":
			foundExtraSlack = true
			require.Len(t, receiver.SlackConfigs, 1)
			require.NotNil(t, receiver.SlackConfigs[0].APIURL)
			require.Equal(t, "#alerts", receiver.SlackConfigs[0].Channel)
		}
	}
	require.True(t, foundDefault, "Default receiver not found")
	require.True(t, foundExtraSlack, "Extra slack receiver not found")
}

// TestIntegrationRemoteAlertmanagerHistoricalConfigActivation tests that when we activate
// a historical alertmanager configuration with extra configs, it gets properly decrypted
// and uploaded to the remote Mimir.
func TestIntegrationRemoteAlertmanagerHistoricalConfigActivation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
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
  receiver: old-slack

receivers:
- name: old-slack
  slack_configs:
  - api_url: 'http://localhost/slack'
    channel: '#alerts'
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
	require.NotNil(t, finalMimirConfig)
	require.NotNil(t, finalMimirConfig.GrafanaAlertmanagerConfig)

	receivers := finalMimirConfig.GrafanaAlertmanagerConfig.AlertmanagerConfig.Receivers
	require.Len(t, receivers, 2)

	found := false
	for _, receiver := range receivers {
		if receiver.Name == "old-slack" {
			found = true
			require.Len(t, receiver.SlackConfigs, 1)
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

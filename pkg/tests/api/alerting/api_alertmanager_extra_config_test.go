package alerting

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationAlertmanagerExtraConfigMerging(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testinfra.SQLiteIntegrationTest(t)

	dir, gpath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
		EnableFeatureToggles: []string{
			"alertingImportAlertmanagerAPI",
			"alertingImportAlertmanagerUI",
		},
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, gpath)
	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	t.Run("retrieve merged configuration via extra config datasource", func(t *testing.T) {
		// first upload standard alertmanager configuration
		baseConfig := apimodels.PostableUserConfig{}
		baseConfigJSON := `{
			"alertmanager_config": {
				"route": {
					"receiver": "base-default"
				},
				"receivers": [{
					"name": "base-default",
					"grafana_managed_receiver_configs": [{
						"name": "base-email",
						"type": "email",
						"settings": {
							"addresses": "example@grafana.com"
						}
					}]
				}]
			},
			"template_files": {
				"base.tmpl": "{{ define \"base.template\" }}Base Template{{ end }}"
			}
		}`
		err := json.Unmarshal([]byte(baseConfigJSON), &baseConfig)
		require.NoError(t, err)

		err = env.Server.HTTPServer.AlertNG.MultiOrgAlertmanager.SaveAndApplyAlertmanagerConfiguration(context.Background(), 1, baseConfig)
		require.NoError(t, err)

		//now add extra configuration
		extraHeaders := map[string]string{
			"Content-Type":                      "application/yaml",
			"X-Grafana-Alerting-Merge-Matchers": "imported=true",
		}

		extraConfigYAML := `
route:
  receiver: extra-webhook

receivers:
- name: extra-webhook
  webhook_configs:
  - url: 'http://external.example.com/webhook'
`

		extraConfig := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: extraConfigYAML,
			TemplateFiles: map[string]string{
				"extra.tmpl": `{{ define "extra.template" }}Extra Template{{ end }}`,
			},
		}

		response := apiClient.ConvertPrometheusPostAlertmanagerConfig(t, extraConfig, extraHeaders)
		require.Equal(t, "success", response.Status)

		// get the merged configuration and check it
		datasourceUID := "~grafana-with-extra-config"
		mergedConfig := apiClient.GetAlertmanagerConfigForDatasource(t, datasourceUID)

		receiverNames := make(map[string]bool)
		for _, recv := range mergedConfig.AlertmanagerConfig.Receivers {
			receiverNames[recv.Name] = true
		}

		require.True(t, receiverNames["base-default"])
		require.True(t, receiverNames["extra-webhook"])

		require.Contains(t, mergedConfig.TemplateFiles, "base.tmpl", "Base template should be present")
		require.Equal(t, `{{ define "base.template" }}Base Template{{ end }}`, mergedConfig.TemplateFiles["base.tmpl"])
		require.Contains(t, mergedConfig.TemplateFiles, "extra.tmpl", "Extra template should be present")
		require.Equal(t, `{{ define "extra.template" }}Extra Template{{ end }}`, mergedConfig.TemplateFiles["extra.tmpl"])

		require.NotNil(t, mergedConfig.AlertmanagerConfig.Route)
	})
}

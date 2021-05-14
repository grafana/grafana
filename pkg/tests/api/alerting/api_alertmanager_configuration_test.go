package alerting

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
)

func TestAlertmanagerConfigurationIsTransactional(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		AnonymousUserRole:    models.ROLE_EDITOR,
	})

	store := testinfra.SetUpDatabase(t, dir)
	grafanaListedAddr := testinfra.StartGrafana(t, dir, path, store)
	alertConfigURL := fmt.Sprintf("http://%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)

	// On a blank start with no configuration, it saves and delivers the default configuration.
	{
		resp := getRequest(t, alertConfigURL, http.StatusOK)
		require.JSONEq(t, defaultAlertmanagerConfigJSON, getBody(t, resp.Body))
	}

	// When creating new configuration, if it fails to apply - it does not save it.
	{
		payload := `
{
	"template_files": {},
	"alertmanager_config": {
		"route": {
			"receiver": "slack.receiver"
		},
		"templates": null,
		"receivers": [{
			"name": "slack.receiver",
			"grafana_managed_receiver_configs": [{
				"settings": {
					"iconEmoji": "",
					"iconUrl": "",
					"mentionGroups": "",
					"mentionUsers": "",
					"recipient": "#unified-alerting-test",
					"username": ""
				},
				"secureSettings": {},
				"type": "slack",
				"sendReminder": true,
				"name": "slack.receiver",
				"disableResolveMessage": false,
				"uid": ""
			}]
		}]
	}
}
`
		resp := postRequest(t, alertConfigURL, payload, http.StatusBadRequest)
		require.JSONEq(t, "{\"error\":\"alert validation error: token must be specified when using the Slack chat API\", \"message\":\"failed to save and apply Alertmanager configuration\"}", getBody(t, resp.Body))

		resp = getRequest(t, alertConfigURL, http.StatusOK)
		require.JSONEq(t, defaultAlertmanagerConfigJSON, getBody(t, resp.Body))
	}
}

func TestAlertmanagerConfigurationPersistSecrets(t *testing.T) {
}

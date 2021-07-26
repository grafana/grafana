package alerting

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/assert"
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
		resp := getRequest(t, alertConfigURL, http.StatusOK) // nolint
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
				"name": "slack.receiver",
				"disableResolveMessage": false,
				"uid": ""
			}]
		}]
	}
}
`
		resp := postRequest(t, alertConfigURL, payload, http.StatusBadRequest) // nolint
		require.JSONEq(t, `{"message":"failed to save and apply Alertmanager configuration: failed to validate receiver \"slack.receiver\" of type \"slack\": token must be specified when using the Slack chat API"}`, getBody(t, resp.Body))

		resp = getRequest(t, alertConfigURL, http.StatusOK) // nolint
		require.JSONEq(t, defaultAlertmanagerConfigJSON, getBody(t, resp.Body))
	}
}

func TestAlertmanagerConfigurationPersistSecrets(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		AnonymousUserRole:    models.ROLE_EDITOR,
	})

	store := testinfra.SetUpDatabase(t, dir)
	grafanaListedAddr := testinfra.StartGrafana(t, dir, path, store)
	alertConfigURL := fmt.Sprintf("http://%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)
	generatedUID := ""

	// create a new configuration that has a secret
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
					"recipient": "#unified-alerting-test"
				},
				"secureSettings": {
					"url": "http://averysecureurl.com/webhook"
				},
				"type": "slack",
				"name": "slack.receiver",
				"disableResolveMessage": false
			}]
		}]
	}
}
`
		resp := postRequest(t, alertConfigURL, payload, http.StatusAccepted) // nolint
		require.JSONEq(t, `{"message":"configuration created"}`, getBody(t, resp.Body))
	}

	// Try to update a receiver with unknown UID
	{
		// Then, update the recipient
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
						"recipient": "#unified-alerting-test-but-updated"
					},
					"secureFields": {
						"url": true
					},
					"type": "slack",
					"name": "slack.receiver",
					"disableResolveMessage": false,
					"uid": "invalid"
				}]
			}]
		}
	}
	`

		resp := postRequest(t, alertConfigURL, payload, http.StatusBadRequest) // nolint
		require.JSONEq(t, `{"message": "unknown receiver: invalid"}`, getBody(t, resp.Body))
	}

	// The secure settings must be present
	{
		resp := getRequest(t, alertConfigURL, http.StatusOK) // nolint
		var c definitions.GettableUserConfig
		bb := getBody(t, resp.Body)
		err := json.Unmarshal([]byte(bb), &c)
		require.NoError(t, err)
		m := c.GetGrafanaReceiverMap()
		assert.Len(t, m, 1)
		for k := range m {
			generatedUID = m[k].UID
		}

		// Then, update the recipient
		payload := fmt.Sprintf(`
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
					"recipient": "#unified-alerting-test-but-updated"
				},
				"secureFields": {
					"url": true
				},
				"type": "slack",
				"name": "slack.receiver",
				"disableResolveMessage": false,
				"uid": %q
			}]
		}]
	}
}
`, generatedUID)

		resp = postRequest(t, alertConfigURL, payload, http.StatusAccepted) // nolint
		require.JSONEq(t, `{"message": "configuration created"}`, getBody(t, resp.Body))
	}

	// The secure settings must be present
	{
		resp := getRequest(t, alertConfigURL, http.StatusOK) // nolint
		require.JSONEq(t, fmt.Sprintf(`
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
				"uid": %q,
				"name": "slack.receiver",
				"type": "slack",
				"disableResolveMessage": false,
				"settings": {
					"recipient": "#unified-alerting-test-but-updated"
				},
				"secureFields": {
					"url": true
				}
			}]
		}]
	}
}
`, generatedUID), getBody(t, resp.Body))
	}
}

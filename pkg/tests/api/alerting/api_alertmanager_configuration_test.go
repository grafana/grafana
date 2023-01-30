package alerting

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestIntegrationAlertmanagerConfigurationIsTransactional(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting:                 true,
		EnableUnifiedAlerting:                 true,
		NGAlertAlertmanagerConfigPollInterval: 2 * time.Second,
		DisableAnonymous:                      true,
		AppModeProduction:                     true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)

	orgService, err := orgimpl.ProvideService(store, store.Cfg, quotatest.New(false, nil))
	require.NoError(t, err)

	// editor from main organisation requests configuration
	alertConfigURL := fmt.Sprintf("http://editor:editor@%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)

	// create user under main organisation
	userID := createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor",
		Login:          "editor",
	})

	// create another organisation
	newOrg, err := orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "another org", UserID: userID})
	require.NoError(t, err)
	orgID := newOrg.ID

	// create user under different organisation
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor-42",
		Login:          "editor-42",
		OrgID:          orgID,
	})

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
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]interface{}
		require.NoError(t, json.Unmarshal(b, &res))
		require.Equal(t, `failed to save and apply Alertmanager configuration: failed to build integration map: the receiver is invalid: failed to validate receiver "slack.receiver" of type "slack": token must be specified when using the Slack chat API`, res["message"])
		resp = getRequest(t, alertConfigURL, http.StatusOK) // nolint

		require.JSONEq(t, defaultAlertmanagerConfigJSON, getBody(t, resp.Body))
	}

	// editor42 from organisation 42 posts configuration
	alertConfigURL = fmt.Sprintf("http://editor-42:editor-42@%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)

	// Before we start operating, make sure we've synced this org.
	require.Eventually(t, func() bool {
		resp, err := http.Get(alertConfigURL) // nolint
		require.NoError(t, err)
		return resp.StatusCode == http.StatusOK
	}, 10*time.Second, 2*time.Second)

	// Post the alertmanager config.
	{
		mockChannel := newMockNotificationChannel(t, grafanaListedAddr)
		amConfig := getAlertmanagerConfig(mockChannel.server.Addr)
		postRequest(t, alertConfigURL, amConfig, http.StatusAccepted) // nolint

		// Verifying that the new configuration is returned
		resp := getRequest(t, alertConfigURL, http.StatusOK) // nolint
		b := getBody(t, resp.Body)
		re := regexp.MustCompile(`"uid":"([\w|-]*)"`)
		e := getExpAlertmanagerConfigFromAPI(mockChannel.server.Addr)
		require.JSONEq(t, e, string(re.ReplaceAll([]byte(b), []byte(`"uid":""`))))
	}

	// verify that main organisation still gets the default configuration
	alertConfigURL = fmt.Sprintf("http://editor:editor@%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)
	{
		resp := getRequest(t, alertConfigURL, http.StatusOK) // nolint
		require.JSONEq(t, defaultAlertmanagerConfigJSON, getBody(t, resp.Body))
	}
}

func TestIntegrationAlertmanagerConfigurationPersistSecrets(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)
	alertConfigURL := fmt.Sprintf("http://editor:editor@%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)

	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor",
		Login:          "editor",
	})
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
		s := getBody(t, resp.Body)
		var res map[string]interface{}
		require.NoError(t, json.Unmarshal([]byte(s), &res))
		require.Equal(t, "unknown receiver: invalid", res["message"])
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

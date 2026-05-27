package v1

import (
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/alerting/definition"
	alertingNotify "github.com/grafana/alerting/notify"
	emailV0 "github.com/grafana/alerting/receivers/email/v0mimir1"
	webhookV0 "github.com/grafana/alerting/receivers/webhook/v0mimir1"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRoundTripConversion(t *testing.T) {
	configJSON := `{
		"template_files": {
			"template1.tmpl": "{{ define \"test\" }}Hello {{ .CommonLabels.alertname }}{{ end }}",
			"template2.tmpl": "{{ define \"test2\" }}Alert: {{ .Status }}{{ end }}"
		},
		"alertmanager_config": {
			"route": {
				"receiver": "default-receiver",
				"group_by": ["alertname", "cluster"],
				"group_wait": "30s",
				"group_interval": "5m",
				"repeat_interval": "1h",
				"routes": [
					{
						"receiver": "critical-receiver",
						"group_by": ["alertname"],
						"matchers": ["severity=\"critical\""],
						"continue": true,
						"group_wait": "10s",
						"repeat_interval": "30m",
						"mute_time_intervals": ["weekends"]
					},
					{
						"receiver": "warning-receiver",
						"group_by": ["alertname", "namespace"],
						"matchers": ["severity=\"warning\""],
						"active_time_intervals": ["business-hours"]
					}
				],
				"provenance": "api"
			},
			"receivers": [
				{
					"name": "default-receiver",
					"grafana_managed_receiver_configs": [
						{
							"uid": "uid-default-1",
							"name": "default-email",
							"type": "email",
							"disableResolveMessage": false,
							"settings": {
								"addresses": "team@example.com"
							}
						}
					]
				},
				{
					"name": "critical-receiver",
					"grafana_managed_receiver_configs": [
						{
							"uid": "uid-critical-1",
							"name": "critical-pagerduty",
							"type": "pagerduty",
							"disableResolveMessage": false,
							"settings": {
								"integrationKey": "abc123"
							}
						},
						{
							"uid": "uid-critical-2",
							"name": "critical-slack",
							"type": "slack",
							"disableResolveMessage": true,
							"settings": {
								"url": "https://hooks.slack.com/services/XXX"
							}
						}
					]
				},
				{
					"name": "warning-receiver",
					"grafana_managed_receiver_configs": [
						{
							"uid": "uid-warning-1",
							"name": "warning-slack",
							"type": "slack",
							"disableResolveMessage": false,
							"settings": {
								"url": "https://hooks.slack.com/services/YYY"
							}
						}
					]
				}
			],
			"inhibit_rules": [
				{
					"source_matchers": ["severity=\"critical\""],
					"target_matchers": ["alertname=~\".*\"", "severity=\"warning\""],
					"equal": ["namespace", "alertname"]
				}
			],
			"mute_time_intervals": [
				{
					"name": "weekends",
					"time_intervals": [
						{
							"weekdays": ["saturday", "sunday"]
						}
					]
				}
			],
			"time_intervals": [
				{
					"name": "business-hours",
					"time_intervals": [
						{
							"times": [
								{
									"start_time": "09:00",
									"end_time": "17:00"
								}
							],
							"weekdays": ["monday:friday"]
						}
					]
				}
			],
			"templates": ["template1.tmpl", "template2.tmpl"]
		},
		"managed_routes": {
			"managed-route-1": {
				"receiver": "critical-receiver",
				"group_by": ["alertname"],
				"matchers": ["team=\"platform\""],
				"group_wait": "15s",
				"repeat_interval": "2h",
				"provenance": "file"
			},
			"managed-route-2": {
				"receiver": "warning-receiver",
				"group_by": ["namespace"],
				"matchers": ["environment=~\"prod|staging\""],
				"continue": true,
				"active_time_intervals": ["business-hours"],
				"provenance": "api"
			}
		},
		"managed_inhibition_rules": {
			"inhibit-rule-1": {
				"name": "inhibit-rule-1",
				"source_matchers": ["alertname=\"HighCPU\""],
				"target_matchers": ["alertname=\"LowMemory\""],
				"equal": ["instance"],
				"provenance": "api"
			},
			"inhibit-rule-2": {
				"name": "inhibit-rule-2",
				"source_matchers": ["namespace=~\"kube-.*\"", "severity=\"critical\""],
				"target_matchers": ["namespace=~\"kube-.*\"", "severity=\"warning\""],
				"equal": ["namespace", "pod"],
				"provenance": "file"
			}
		},
		"extra_config": [
			{
				"identifier": "remote-primary",
				"template_files": {
					"remote-template.tmpl": "{{ define \"remote\" }}Remote alert{{ end }}"
				},
				"alertmanager_config": "route:\n  receiver: remote-default\nreceivers:\n  - name: remote-default\n"
			}
		]
	}`

	originalDB := &AMConfigDB{}
	err := json.Unmarshal([]byte(configJSON), originalDB)
	require.NoError(t, err, "failed to unmarshal test config")

	// Convert DB -> Model
	model := ToModel(originalDB)
	require.NotNil(t, model)

	// Convert Model -> DB
	convertedDB, err := ToDBModel(model)
	require.NoError(t, err)
	require.NotNil(t, convertedDB)

	diff := cmp.Diff(originalDB, convertedDB, cmpopts.IgnoreUnexported(AMConfigDB{}, definition.Route{}, labels.Matcher{}))
	if diff != "" {
		t.Errorf("Unexpected change in converted DB: %v", diff)
	}

	convertedJSON, err := json.Marshal(convertedDB)
	require.NoError(t, err)

	require.JSONEq(t, configJSON, string(convertedJSON),
		"Round-trip conversion should be lossless")
}

func TestPostableMimirReceiverToPostableGrafanaReceiver(t *testing.T) {
	t.Run("returns original pointer when receiver has only Grafana integrations", func(t *testing.T) {
		receiver := &PostableApiReceiver{
			Receiver: definition.Receiver{Name: "test"},
			PostableGrafanaReceivers: PostableGrafanaReceivers{
				GrafanaManagedReceivers: []*PostableGrafanaReceiver{
					{UID: "grafana-uid", Name: "test", Type: "email"},
				},
			},
		}
		result, err := PostableMimirReceiverToPostableGrafanaReceiver(receiver)
		require.NoError(t, err)
		assert.Same(t, receiver, result)
	})

	t.Run("converts Mimir integrations to Grafana integrations", func(t *testing.T) {
		wh := webhookV0.GetFullValidConfig()
		receiver := &PostableApiReceiver{
			Receiver: definition.Receiver{
				Name:           "test-receiver",
				WebhookConfigs: []*webhookV0.Config{&wh},
			},
		}

		mimirConfigs, err := alertingNotify.ConfigReceiverToMimirIntegrations(receiver.Receiver)
		require.NoError(t, err)
		require.Len(t, mimirConfigs, 1)
		expectedJSON, err := mimirConfigs[0].ConfigJSON()
		require.NoError(t, err)

		result, err := PostableMimirReceiverToPostableGrafanaReceiver(receiver)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.NotSame(t, receiver, result)
		require.Len(t, result.GrafanaManagedReceivers, 1)

		converted := result.GrafanaManagedReceivers[0]
		assert.Equal(t, "test-receiver", result.Name)
		assert.Equal(t, "test-receiver", converted.Name)
		assert.Equal(t, mimirIntegrationUID("test-receiver", "webhook", 0), converted.UID)
		assert.JSONEq(t, string(expectedJSON), string(converted.Settings))
		assert.False(t, converted.DisableResolveMessage)
		assert.Nil(t, converted.SecureSettings)
		assert.False(t, result.HasMimirIntegrations())
	})

	t.Run("existing Grafana integrations appear before converted Mimir ones", func(t *testing.T) {
		wh := webhookV0.GetFullValidConfig()
		grafanaRecv := &PostableGrafanaReceiver{
			UID:  "existing-uid",
			Name: "existing",
			Type: "email",
		}
		receiver := &PostableApiReceiver{
			Receiver: definition.Receiver{
				Name:           "mixed-receiver",
				WebhookConfigs: []*webhookV0.Config{&wh},
			},
			PostableGrafanaReceivers: PostableGrafanaReceivers{
				GrafanaManagedReceivers: []*PostableGrafanaReceiver{grafanaRecv},
			},
		}

		result, err := PostableMimirReceiverToPostableGrafanaReceiver(receiver)
		require.NoError(t, err)
		require.Len(t, result.GrafanaManagedReceivers, 2)
		assert.Same(t, grafanaRecv, result.GrafanaManagedReceivers[0])
		assert.Equal(t, "webhook", result.GrafanaManagedReceivers[1].Type)
	})

	t.Run("assigns per-type UIDs to converted Mimir integrations", func(t *testing.T) {
		// UIDs are indexed per integration type, so each type starts at 0.
		em := emailV0.GetFullValidConfig()
		wh := webhookV0.GetFullValidConfig()
		receiver := &PostableApiReceiver{
			Receiver: definition.Receiver{
				Name:           "multi-receiver",
				EmailConfigs:   []*emailV0.Config{&em},
				WebhookConfigs: []*webhookV0.Config{&wh},
			},
		}

		result, err := PostableMimirReceiverToPostableGrafanaReceiver(receiver)
		require.NoError(t, err)
		require.Len(t, result.GrafanaManagedReceivers, 2)

		assert.Equal(t, mimirIntegrationUID("multi-receiver", "email", 0), result.GrafanaManagedReceivers[0].UID)
		assert.Equal(t, mimirIntegrationUID("multi-receiver", "webhook", 0), result.GrafanaManagedReceivers[1].UID)
	})
}

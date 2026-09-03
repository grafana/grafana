package v1

import (
	"encoding/json"
	"fmt"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/definition/compat"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/notify/notifytest"
	emailV0 "github.com/grafana/alerting/receivers/email/v0mimir1"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/teams"
	webhookV0 "github.com/grafana/alerting/receivers/webhook/v0mimir1"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRoundTripConversion(t *testing.T) {
	extraConfig := `
route:
  receiver: imported-receiver-1
receivers:
  - name: imported-receiver-1
    webhook_configs:
      - url: "http://localhost/"
  - name: imported-receiver-2
    webhook_configs:
      - url: "http://localhost/"
inhibit_rules:
  - source_matchers:
      - alertname = SourceAlert
    target_matchers:
      - alertname = TargetAlert
    equal:
      - cluster
  - source_matchers:
      - severity = critical
    target_matchers:
      - severity = warning
    equal:
      - instance
`
	configJSON := fmt.Sprintf(`{
		"managed_templates": {
			"template1.tmpl": {"name":"template1.tmpl","content":"{{ define \"test\" }}Hello {{ .CommonLabels.alertname }}{{ end }}","kind":"grafana"},
			"template2.tmpl": {"name":"template2.tmpl","content":"{{ define \"test2\" }}Alert: {{ .Status }}{{ end }}","kind":"grafana"}
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
					"source_matchers": ["severity=\"warning\""],
					"target_matchers": ["alertname=~\".*\"", "severity=\"warning\""],
					"equal": ["namespace", "alertname"]
				},
				{
					"source_matchers": ["severity=\"critical\""],
					"target_matchers": ["alertname=~\".*\"", "severity=\"critical\""],
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
				"group_wait": "15s",
				"repeat_interval": "2h",
				"provenance": "file",
				"routes": [
					{
						"receiver": "warning-receiver",
						"matchers": ["team=\"platform\""]
					}
				]
			},
			"managed-route-2": {
				"receiver": "warning-receiver",
				"group_by": ["namespace"],
				"continue": true,
				"provenance": "api",
				"routes": [
					{
						"receiver": "critical-receiver",
						"matchers": ["environment=~\"prod|staging\""],
						"active_time_intervals": ["business-hours"]
					}
				]
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
				"alertmanager_config": %q
			}
		]
	}`, extraConfig)

	originalDB := &AMConfigDB{}
	err := json.Unmarshal([]byte(configJSON), originalDB)
	require.NoError(t, err, "failed to unmarshal test config")

	// Convert DB -> Model
	model := ToModel(originalDB)
	require.NotNil(t, model)

	// Ensure passes validation.
	require.NoError(t, model.Validate())

	// Convert Model -> DB
	convertedDB, err := ToDBModel(model)
	require.NoError(t, err)
	require.NotNil(t, convertedDB)

	// The round-trip is lossless except that deprecated mute_time_intervals are folded into
	// time_intervals (sorted by name) by design, so build the expectation from the same fold.
	for _, mt := range originalDB.AlertmanagerConfig.MuteTimeIntervals {
		originalDB.AlertmanagerConfig.TimeIntervals = append(originalDB.AlertmanagerConfig.TimeIntervals, config.TimeInterval(mt))
	}
	originalDB.AlertmanagerConfig.MuteTimeIntervals = nil
	slices.SortFunc(originalDB.AlertmanagerConfig.TimeIntervals, func(a, b config.TimeInterval) int {
		return strings.Compare(a.Name, b.Name)
	})

	diff := cmp.Diff(originalDB, convertedDB, cmpopts.IgnoreUnexported(AMConfigDB{}, definition.Route{}, labels.Matcher{}))
	if diff != "" {
		t.Errorf("Unexpected change in converted DB: %v", diff)
	}

	expectedJSON, err := json.Marshal(originalDB)
	require.NoError(t, err)
	convertedJSON, err := json.Marshal(convertedDB)
	require.NoError(t, err)

	require.JSONEq(t, string(expectedJSON), string(convertedJSON),
		"Round-trip conversion should be lossless")
}

func TestMigrationFromTemplateFiles(t *testing.T) {
	// Old configs stored templates in template_files. Verify they load correctly
	// and are converted to managed_templates on save.
	input := &AMConfigDB{}
	require.NoError(t, json.Unmarshal([]byte(`{
		"template_files": {
			"tmpl.tmpl": "{{ define \"alert\" }}hello{{ end }}"
		},
		"alertmanager_config": {
			"route": {"receiver": "recv"},
			"receivers": [{"name": "recv"}]
		}
	}`), input))

	model := ToModel(input)
	require.NotNil(t, model)
	require.Len(t, model.Templates, 1)

	output, err := ToDBModel(model)
	require.NoError(t, err)
	require.Nil(t, output.TemplateFiles, "TemplateFiles must be wiped on write")
	require.Len(t, output.ManagedTemplates, 1)

	expectedUID := string(TemplateUID(TemplateKindGrafana, "tmpl.tmpl"))
	mt, ok := output.ManagedTemplates[expectedUID]
	require.True(t, ok)
	assert.Equal(t, "tmpl.tmpl", mt.Name)
	assert.Equal(t, definition.GrafanaTemplateKind, mt.Kind)
}

func TestToModel_TemplateConflicts(t *testing.T) {
	minimalAMConfig := `{"route":{"receiver":"recv"},"receivers":[{"name":"recv"}]}`

	t.Run("managed_templates_wins_on_uid_conflict", func(t *testing.T) {
		// A template present in both fields with the same UID: ManagedTemplates must win.
		conflictUID := string(TemplateUID(TemplateKindGrafana, "tmpl.tmpl"))
		input := &AMConfigDB{}
		require.NoError(t, json.Unmarshal([]byte(`{
			"template_files": {"tmpl.tmpl": "{{ define \"alert\" }}old{{ end }}"},
			"managed_templates": {"`+conflictUID+`": {"name":"tmpl.tmpl","content":"{{ define \"alert\" }}new{{ end }}","kind":"grafana"}},
			"alertmanager_config": `+minimalAMConfig+`
		}`), input))

		model := ToModel(input)
		require.Len(t, model.Templates, 1)
		assert.Equal(t, `{{ define "alert" }}new{{ end }}`, model.Templates[ResourceUID(conflictUID)].Content)
	})

	t.Run("no_conflict_both_templates_present", func(t *testing.T) {
		// Different UIDs: both templates should be in the merged result.
		input := &AMConfigDB{}
		require.NoError(t, json.Unmarshal([]byte(`{
			"template_files": {"a.tmpl": "{{ define \"a\" }}A{{ end }}"},
			"managed_templates": {"`+string(TemplateUID(TemplateKindGrafana, "b.tmpl"))+`": {"name":"b.tmpl","content":"{{ define \"b\" }}B{{ end }}","kind":"grafana"}},
			"alertmanager_config": `+minimalAMConfig+`
		}`), input))

		model := ToModel(input)
		require.Len(t, model.Templates, 2)
		assert.Contains(t, model.Templates, TemplateUID(TemplateKindGrafana, "a.tmpl"))
		assert.Contains(t, model.Templates, TemplateUID(TemplateKindGrafana, "b.tmpl"))
	})
}

func TestPostableMimirReceiverToPostableGrafanaReceiver(t *testing.T) {
	t.Run("returns receiver with no integrations when legacy receiver has none", func(t *testing.T) {
		receiver := compat.Receiver{Name: "test"}
		result, err := PostableMimirReceiverToPostableGrafanaReceiver(receiver)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, "test", result.Name)
		assert.Empty(t, result.GrafanaManagedReceivers)
	})

	t.Run("converts Mimir integrations to Grafana integrations", func(t *testing.T) {
		wh := webhookV0.GetFullValidConfig()
		receiver := compat.Receiver{
			Name:           "test-receiver",
			WebhookConfigs: []*webhookV0.Config{&wh},
		}

		mimirConfigs, err := alertingNotify.ConfigReceiverToMimirIntegrations(receiver)
		require.NoError(t, err)
		require.Len(t, mimirConfigs, 1)
		expectedJSON, err := mimirConfigs[0].ConfigJSON()
		require.NoError(t, err)

		result, err := PostableMimirReceiverToPostableGrafanaReceiver(receiver)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Len(t, result.GrafanaManagedReceivers, 1)

		converted := result.GrafanaManagedReceivers[0]
		assert.Equal(t, "test-receiver", result.Name)
		assert.Equal(t, "test-receiver", converted.Name)
		assert.Equal(t, mimirIntegrationUID("test-receiver", "webhook", 0), converted.UID)
		assert.JSONEq(t, string(expectedJSON), string(converted.Settings))
		assert.False(t, converted.DisableResolveMessage)
		assert.Nil(t, converted.SecureSettings)
	})

	t.Run("assigns per-type UIDs to converted Mimir integrations", func(t *testing.T) {
		// UIDs are indexed per integration type, so each type starts at 0.
		em := emailV0.GetFullValidConfig()
		wh := webhookV0.GetFullValidConfig()
		receiver := compat.Receiver{
			Name:           "multi-receiver",
			EmailConfigs:   []*emailV0.Config{&em},
			WebhookConfigs: []*webhookV0.Config{&wh},
		}

		result, err := PostableMimirReceiverToPostableGrafanaReceiver(receiver)
		require.NoError(t, err)
		require.Len(t, result.GrafanaManagedReceivers, 2)

		assert.Equal(t, mimirIntegrationUID("multi-receiver", "email", 0), result.GrafanaManagedReceivers[0].UID)
		assert.Equal(t, mimirIntegrationUID("multi-receiver", "webhook", 0), result.GrafanaManagedReceivers[1].UID)
	})

	t.Run("can convert all known types", func(t *testing.T) {
		notifytest.ForEachIntegrationTypeReceiver(t, func(configType reflect.Type, receiver compat.Receiver, rawConfig string) {
			expectedType, err := alertingNotify.IntegrationTypeFromMimirTypeReflect(configType)
			assert.NoError(t, err)
			expectedVersion := schema.V0mimir1
			if strings.Contains(configType.PkgPath(), "/teams/v0mimir1") {
				expectedType = teams.Type
			}
			if strings.Contains(configType.PkgPath(), "/teams/v0mimir2") {
				expectedType = teams.Type
				expectedVersion = schema.V0mimir2
			}
			t.Run(fmt.Sprintf("%s as %s %s", configType.PkgPath(), expectedType, expectedVersion), func(t *testing.T) {
				result, err := PostableMimirReceiverToPostableGrafanaReceiver(receiver)
				require.NoError(t, err)
				require.Len(t, result.GrafanaManagedReceivers, 1)
				converted := result.GrafanaManagedReceivers[0]

				assert.EqualValues(t, expectedVersion, converted.Version)
				assert.EqualValues(t, expectedType, converted.Type)
				assert.JSONEq(t, rawConfig, string(converted.Settings))
				assert.Empty(t, converted.SecureSettings)
			})
		})
	})

	t.Run("can convert receiver with all integrations", func(t *testing.T) {
		recv, err := notifytest.GetMimirReceiverWithAllIntegrations()
		require.NoError(t, err)
		result, err := PostableMimirReceiverToPostableGrafanaReceiver(recv)
		require.NoError(t, err)
		require.Len(t, result.GrafanaManagedReceivers, len(notifytest.AllValidMimirConfigs))
	})
}

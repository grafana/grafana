package api

import (
	"context"
	"encoding/base64"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/alerting/notify"
	receiversTesting "github.com/grafana/alerting/receivers/testing"
	"github.com/stretchr/testify/require"

	apicompat "github.com/grafana/grafana/pkg/services/ngalert/api/compat"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/util"
)

// Test that conversion notify.APIReceiver -> definitions.ContactPoint -> notify.APIReceiver does not lose data
func TestContactPointFromContactPointExports(t *testing.T) {
	getContactPointExport := func(t *testing.T, receiver *notify.APIReceiver) definitions.ContactPointExport {
		export := make([]definitions.ReceiverExport, 0, len(receiver.Integrations))
		for _, integrationConfig := range receiver.Integrations {
			postable := &definitions.PostableGrafanaReceiver{
				UID:                   integrationConfig.UID,
				Name:                  integrationConfig.Name,
				Type:                  integrationConfig.Type,
				DisableResolveMessage: integrationConfig.DisableResolveMessage,
				Settings:              definitions.RawMessage(integrationConfig.Settings),
				SecureSettings:        integrationConfig.SecureSettings,
			}
			emb, _, err := provisioning.PostableGrafanaReceiverToEmbeddedContactPoint(
				postable,
				models.ProvenanceNone,
				func(s string) string { // test configs are not encrypted but encoded
					d, err := base64.StdEncoding.DecodeString(s)
					require.NoError(t, err)
					return string(d)
				})
			require.NoError(t, err)
			ex, err := apicompat.ReceiverExportFromEmbeddedContactPoint(emb)
			require.NoError(t, err)
			export = append(export, ex)
		}

		return definitions.ContactPointExport{
			OrgID:     1,
			Name:      receiver.Name,
			Receivers: export,
		}
	}

	// use the configs for testing because they have all fields supported by integrations
	for integrationType, cfg := range notify.AllKnownConfigsForTesting {
		t.Run(integrationType, func(t *testing.T) {
			recCfg := &notify.APIReceiver{
				ConfigReceiver: notify.ConfigReceiver{Name: "test-receiver"},
				GrafanaIntegrations: notify.GrafanaIntegrations{
					Integrations: []*notify.GrafanaIntegrationConfig{
						cfg.GetRawNotifierConfig("test"),
					},
				},
			}

			expected, err := notify.BuildReceiverConfiguration(context.Background(), recCfg, notify.DecodeSecretsFromBase64, func(ctx context.Context, sjd map[string][]byte, key string, fallback string) string {
				return receiversTesting.DecryptForTesting(sjd)(key, fallback)
			})
			require.NoError(t, err)

			result, err := ContactPointFromContactPointExport(getContactPointExport(t, recCfg))
			require.NoError(t, err)

			back, err := ContactPointToContactPointExport(result)
			require.NoError(t, err)

			actual, err := notify.BuildReceiverConfiguration(context.Background(), &back, notify.DecodeSecretsFromBase64, func(ctx context.Context, sjd map[string][]byte, key string, fallback string) string {
				return receiversTesting.DecryptForTesting(sjd)(key, fallback)
			})
			require.NoError(t, err)

			pathFilters := []string{
				"Metadata.UID",
				"Metadata.Name",
				"WecomConfigs.Settings.EndpointURL", // This field is not exposed to user
			}
			if integrationType != "webhook" {
				// Many notifiers now support HTTPClientConfig but only Webhook currently has it enabled in schema.
				//TODO: Remove this once HTTPClientConfig is added to other schemas.
				pathFilters = append(pathFilters, "HTTPClientConfig")
			}
			pathFilter := cmp.FilterPath(func(path cmp.Path) bool {
				for _, filter := range pathFilters {
					if strings.Contains(path.String(), filter) {
						return true
					}
				}
				return false
			}, cmp.Ignore())

			diff := cmp.Diff(expected, actual, pathFilter)
			if len(diff) != 0 {
				require.Failf(t, "The re-marshalled configuration does not match the expected one", diff)
			}
		})
	}

	t.Run("pushover optional numbers as string", func(t *testing.T) {
		export := definitions.ContactPointExport{
			Name: "test",
			Receivers: []definitions.ReceiverExport{
				{
					Type: "pushover",
					Settings: definitions.RawMessage(
						`{
						"priority": 1,
						"okPriority": "2",
						"expire": null,
						"retry": "invalid"
					}`),
				},
			},
		}
		result, err := ContactPointFromContactPointExport(export)
		require.NoError(t, err)
		require.Len(t, result.Pushover, 1)
		require.Equal(t, int64(1), *result.Pushover[0].AlertingPriority)
		require.Equal(t, int64(2), *result.Pushover[0].OKPriority)
		require.Nil(t, result.Pushover[0].Expire)
		require.Nil(t, result.Pushover[0].Retry)
	})
	t.Run("email with multiple addresses", func(t *testing.T) {
		export := definitions.ContactPointExport{
			Name: "test",
			Receivers: []definitions.ReceiverExport{
				{
					Type:     "email",
					Settings: definitions.RawMessage(`{"addresses": "test@grafana.com,test2@grafana.com;test3@grafana.com\ntest4@granafa.com"}`),
				},
			},
		}
		result, err := ContactPointFromContactPointExport(export)
		require.NoError(t, err)
		require.Len(t, result.Email, 1)
		require.EqualValues(t, []string{
			"test@grafana.com",
			"test2@grafana.com",
			"test3@grafana.com",
			"test4@granafa.com",
		}, result.Email[0].Addresses)
	})
	t.Run("webhook with optional numbers as string", func(t *testing.T) {
		export := definitions.ContactPointExport{
			Name: "test",
			Receivers: []definitions.ReceiverExport{
				{
					Type:     "webhook",
					Settings: definitions.RawMessage(`{ "maxAlerts" : "112" }`),
				},
				{
					Type:     "webhook",
					Settings: definitions.RawMessage(`{ "maxAlerts" : "test" }`),
				},
				{
					Type:     "webhook",
					Settings: definitions.RawMessage(`{ "maxAlerts" : null }`),
				},
			},
		}
		result, err := ContactPointFromContactPointExport(export)
		require.NoError(t, err)
		require.Len(t, result.Webhook, 3)
		require.Equal(t, int64(112), *result.Webhook[0].MaxAlerts)
		require.Nil(t, result.Webhook[1].MaxAlerts)
		require.Nil(t, result.Webhook[2].MaxAlerts)
	})

	t.Run("oncall with optional numbers as string", func(t *testing.T) {
		export := definitions.ContactPointExport{
			Name: "test",
			Receivers: []definitions.ReceiverExport{
				{
					Type:     "oncall",
					Settings: definitions.RawMessage(`{ "maxAlerts" : "112" }`),
				},
				{
					Type:     "oncall",
					Settings: definitions.RawMessage(`{ "maxAlerts" : "test" }`),
				},
				{
					Type:     "oncall",
					Settings: definitions.RawMessage(`{ "maxAlerts" : null }`),
				},
			},
		}
		result, err := ContactPointFromContactPointExport(export)
		require.NoError(t, err)
		require.Len(t, result.OnCall, 3)
		require.Equal(t, int64(112), *result.OnCall[0].MaxAlerts)
		require.Nil(t, result.OnCall[1].MaxAlerts)
		require.Nil(t, result.OnCall[2].MaxAlerts)
	})

	t.Run("mqtt with optional numbers as string", func(t *testing.T) {
		export := definitions.ContactPointExport{
			Name: "test",
			Receivers: []definitions.ReceiverExport{
				{
					Type:     "mqtt",
					Settings: definitions.RawMessage(`{ "qos" : "112" }`),
				},
				{
					Type:     "mqtt",
					Settings: definitions.RawMessage(`{ "qos" : "test" }`),
				},
				{
					Type:     "mqtt",
					Settings: definitions.RawMessage(`{ "qos" : null }`),
				},
			},
		}
		result, err := ContactPointFromContactPointExport(export)
		require.NoError(t, err)
		require.Len(t, result.Mqtt, 3)
		require.Equal(t, int64(112), *result.Mqtt[0].QoS)
		require.Nil(t, result.Mqtt[1].QoS)
		require.Nil(t, result.Mqtt[2].QoS)
	})

	t.Run("jira with various fields values as string", func(t *testing.T) {
		testcases := []struct {
			name        string
			input       definitions.RawMessage
			expected    *string
			expectedErr bool
		}{
			{
				name:     "standard map[string]string",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : "test-value"} }`),
				expected: util.Pointer(`{"test-data":"test-value"}`),
			},
			{
				name:     "map[string]int",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : 42} }`),
				expected: util.Pointer(`{"test-data":42}`),
			},
			{
				name:     "map[string]interface{} with null value",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : null} }`),
				expected: util.Pointer(`{"test-data":null}`),
			},
			{
				name:     "null fields",
				input:    definitions.RawMessage(`{ "fields" : null }`),
				expected: nil,
			},
			{
				name:     "empty map",
				input:    definitions.RawMessage(`{ "fields" : {} }`),
				expected: util.Pointer(`{}`),
			},
			{
				name:     "nested map",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : {"test-data-nested" : "test-value-nested"}} }`),
				expected: util.Pointer(`{"test-data":{"test-data-nested":"test-value-nested"}}`),
			},
			{
				name:     "nested slice",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : ["slice1", "slice2"]} }`),
				expected: util.Pointer(`{"test-data":["slice1","slice2"]}`),
			},
			{
				name:        "string value",
				input:       definitions.RawMessage(`{ "fields" : "some string" }`),
				expectedErr: true,
			},
			{
				name:        "slice",
				input:       definitions.RawMessage(`{ "fields" : ["slice1", "slice2"} }`),
				expectedErr: true,
			},
		}
		for _, tc := range testcases {
			t.Run(tc.name, func(t *testing.T) {
				export := definitions.ContactPointExport{
					Name: "test",
					Receivers: []definitions.ReceiverExport{
						{
							Type:     "jira",
							Settings: tc.input,
						},
					},
				}

				result, err := ContactPointFromContactPointExport(export)
				if tc.expectedErr {
					require.Error(t, err, "Expected error for input: %s", tc.input)
					return
				} else {
					require.NoError(t, err, "Unexpected error for input: %s", tc.input)
				}
				require.Len(t, result.Jira, 1)

				if tc.expected == nil {
					require.Nil(t, result.Jira[0].Fields)
				} else {
					require.Equal(t, *tc.expected, *result.Jira[0].Fields)
				}
			})
		}
	})
}

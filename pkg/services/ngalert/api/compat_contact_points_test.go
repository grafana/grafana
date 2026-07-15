package api

import (
	"encoding/base64"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	alertingmodels "github.com/grafana/alerting/models"
	"github.com/grafana/alerting/notify/notifytest"

	apicompat "github.com/grafana/grafana/pkg/services/ngalert/api/compat"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

// Test that conversion alertingmodels.ReceiverConfig -> definitions.ContactPoint -> alertingmodels.ReceiverConfig does not lose data
func TestContactPointFromContactPointExports(t *testing.T) {
	getContactPointExport := func(t *testing.T, receiver *alertingmodels.ReceiverConfig) definitions.ContactPointExport {
		export := make([]definitions.ReceiverExport, 0, len(receiver.Integrations))
		for _, integrationConfig := range receiver.Integrations {
			postable := &definitions.PostableGrafanaReceiver{
				UID:                   integrationConfig.UID,
				Name:                  integrationConfig.Name,
				Type:                  string(integrationConfig.Type),
				Version:               string(integrationConfig.Version),
				DisableResolveMessage: integrationConfig.DisableResolveMessage,
				Settings:              definitions.RawMessage(integrationConfig.Settings),
				SecureSettings:        integrationConfig.SecureSettings,
			}
			emb, err := provisioning.PostableGrafanaReceiverToEmbeddedContactPoint(
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
	for integrationType, cfg := range notifytest.AllKnownV1ConfigsForTesting {
		t.Run(string(integrationType), func(t *testing.T) {
			recCfg := &alertingmodels.ReceiverConfig{
				Name: "test-receiver",
				Integrations: []*alertingmodels.IntegrationConfig{
					cfg.GetRawNotifierConfig("test"),
				},
			}

			expected, err := ContactPointFromContactPointExport(getContactPointExport(t, recCfg))
			require.NoError(t, err)

			back, err := ContactPointToContactPointExport(expected)
			require.NoError(t, err)

			// Run the export/import conversion a second time on the round-tripped config. If the first
			// conversion lost or altered any data, re-importing it will no longer match `expected`.
			actual, err := ContactPointFromContactPointExport(getContactPointExport(t, &back))
			require.NoError(t, err)

			diff := cmp.Diff(expected, actual)
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
				expected: new(`{"test-data":"test-value"}`),
			},
			{
				name:     "map[string]int",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : 42} }`),
				expected: new(`{"test-data":42}`),
			},
			{
				name:     "map[string]interface{} with null value",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : null} }`),
				expected: new(`{"test-data":null}`),
			},
			{
				name:     "null fields",
				input:    definitions.RawMessage(`{ "fields" : null }`),
				expected: nil,
			},
			{
				name:     "empty map",
				input:    definitions.RawMessage(`{ "fields" : {} }`),
				expected: new(`{}`),
			},
			{
				name:     "nested map",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : {"test-data-nested" : "test-value-nested"}} }`),
				expected: new(`{"test-data":{"test-data-nested":"test-value-nested"}}`),
			},
			{
				name:     "nested slice",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : ["slice1", "slice2"]} }`),
				expected: new(`{"test-data":["slice1","slice2"]}`),
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

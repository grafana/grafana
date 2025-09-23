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

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
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
			emb, err := provisioning.PostableGrafanaReceiverToEmbeddedContactPoint(
				postable,
				models.ProvenanceNone,
				func(s string) string { // test configs are not encrypted but encoded
					d, err := base64.StdEncoding.DecodeString(s)
					require.NoError(t, err)
					return string(d)
				})
			require.NoError(t, err)
			ex, err := ReceiverExportFromEmbeddedContactPoint(emb)
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

			diff := cmp.Diff(expected, actual, cmp.FilterPath(func(path cmp.Path) bool {
				return strings.Contains(path.String(), "Metadata.UID") ||
					strings.Contains(path.String(), "Metadata.Name") ||
					strings.Contains(path.String(), "WecomConfigs.Settings.EndpointURL") // This field is not exposed to user
			}, cmp.Ignore()))
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
}

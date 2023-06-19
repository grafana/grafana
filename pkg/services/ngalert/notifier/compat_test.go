package notifier

import (
	"encoding/json"
	"testing"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/require"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func TestPostableGrafanaReceiverToGrafanaIntegrationConfig(t *testing.T) {
	r := &apimodels.PostableGrafanaReceiver{
		UID:                   "test-uid",
		Name:                  "test-name",
		Type:                  "slack",
		DisableResolveMessage: false,
		Settings:              apimodels.RawMessage(`{ "data" : "test" }`),
		SecureSettings: map[string]string{
			"test": "data",
		},
	}
	actual := PostableGrafanaReceiverToGrafanaIntegrationConfig(r)
	require.Equal(t, alertingNotify.GrafanaIntegrationConfig{
		UID:                   "test-uid",
		Name:                  "test-name",
		Type:                  "slack",
		DisableResolveMessage: false,
		Settings:              json.RawMessage(`{ "data" : "test" }`),
		SecureSettings: map[string]string{
			"test": "data",
		},
	}, *actual)
}

func TestPostableApiReceiverToApiReceiver(t *testing.T) {
	t.Run("returns empty when no receivers", func(t *testing.T) {
		r := &apimodels.PostableApiReceiver{
			Receiver: config.Receiver{
				Name: "test-receiver",
			},
		}
		actual := PostableApiReceiverToApiReceiver(r)
		require.Empty(t, actual.Integrations)
		require.Equal(t, r.Receiver, actual.ConfigReceiver)
	})
	t.Run("converts receivers", func(t *testing.T) {
		r := &apimodels.PostableApiReceiver{
			Receiver: config.Receiver{
				Name: "test-receiver",
			},
			PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{
				GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{
					{
						UID:                   "test-uid",
						Name:                  "test-name",
						Type:                  "slack",
						DisableResolveMessage: false,
						Settings:              apimodels.RawMessage(`{ "data" : "test" }`),
						SecureSettings: map[string]string{
							"test": "data",
						},
					},
					{
						UID:                   "test-uid2",
						Name:                  "test-name2",
						Type:                  "webhook",
						DisableResolveMessage: false,
						Settings:              apimodels.RawMessage(`{ "data2" : "test2" }`),
						SecureSettings: map[string]string{
							"test2": "data2",
						},
					},
				},
			},
		}
		actual := PostableApiReceiverToApiReceiver(r)
		require.Len(t, actual.Integrations, 2)
		require.Equal(t, r.Receiver, actual.ConfigReceiver)
		require.Equal(t, *PostableGrafanaReceiverToGrafanaIntegrationConfig(r.GrafanaManagedReceivers[0]), *actual.Integrations[0])
		require.Equal(t, *PostableGrafanaReceiverToGrafanaIntegrationConfig(r.GrafanaManagedReceivers[1]), *actual.Integrations[1])
	})
}

func TestPostableApiAlertingConfigToApiReceivers(t *testing.T) {
	t.Run("returns empty when no receivers", func(t *testing.T) {
		r := apimodels.PostableApiAlertingConfig{
			Config: apimodels.Config{},
		}
		actual := PostableApiAlertingConfigToApiReceivers(r)
		require.Empty(t, actual)
	})
	c := apimodels.PostableApiAlertingConfig{
		Config: apimodels.Config{},
		Receivers: []*apimodels.PostableApiReceiver{
			{
				Receiver: config.Receiver{
					Name: "test-receiver",
				},
				PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{
					GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{
						{
							UID:                   "test-uid",
							Name:                  "test-name",
							Type:                  "slack",
							DisableResolveMessage: false,
							Settings:              apimodels.RawMessage(`{ "data" : "test" }`),
							SecureSettings: map[string]string{
								"test": "data",
							},
						},
					},
				},
			},
			{
				Receiver: config.Receiver{
					Name: "test-receiver2",
				},
				PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{
					GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{
						{
							UID:                   "test-uid2",
							Name:                  "test-name1",
							Type:                  "slack",
							DisableResolveMessage: false,
							Settings:              apimodels.RawMessage(`{ "data" : "test" }`),
							SecureSettings: map[string]string{
								"test": "data",
							},
						},
					},
				},
			},
		},
	}
	actual := PostableApiAlertingConfigToApiReceivers(c)

	require.Len(t, actual, 2)
	require.Equal(t, PostableApiReceiverToApiReceiver(c.Receivers[0]), actual[0])
	require.Equal(t, PostableApiReceiverToApiReceiver(c.Receivers[1]), actual[1])
}

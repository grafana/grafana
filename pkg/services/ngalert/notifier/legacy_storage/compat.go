package legacy_storage

import (
	"encoding/base64"
	"encoding/json"
	"maps"

	alertingNotify "github.com/grafana/alerting/notify"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var NameToUid = models.NameToUid

func UidToName(uid string) (string, error) {
	data, err := base64.RawURLEncoding.DecodeString(uid)
	if err != nil {
		return uid, err
	}
	return string(data), nil
}

func IntegrationToPostableGrafanaReceiver(integration *models.Integration) (*apimodels.PostableGrafanaReceiver, error) {
	postable := &apimodels.PostableGrafanaReceiver{
		UID:                   integration.UID,
		Name:                  integration.Name,
		Type:                  integration.Config.Type,
		DisableResolveMessage: integration.DisableResolveMessage,
		SecureSettings:        maps.Clone(integration.SecureSettings),
	}

	// Alertmanager will fail validation with nil Settings , so ensure we always have at least an empty map.
	settings := integration.Settings
	if settings == nil {
		settings = make(map[string]any)
	}

	jsonBytes, err := json.Marshal(settings)
	if err != nil {
		return nil, err
	}
	postable.Settings = jsonBytes
	return postable, nil
}

func ReceiverToPostableApiReceiver(r *models.Receiver) (*apimodels.PostableApiReceiver, error) {
	integrations := apimodels.PostableGrafanaReceivers{
		GrafanaManagedReceivers: make([]*apimodels.PostableGrafanaReceiver, 0, len(r.Integrations)),
	}
	for _, cfg := range r.Integrations {
		postable, err := IntegrationToPostableGrafanaReceiver(cfg)
		if err != nil {
			return nil, err
		}
		integrations.GrafanaManagedReceivers = append(integrations.GrafanaManagedReceivers, postable)
	}

	return &apimodels.PostableApiReceiver{
		Receiver: alertingNotify.ConfigReceiver{
			Name: r.Name,
		},
		PostableGrafanaReceivers: integrations,
	}, nil
}

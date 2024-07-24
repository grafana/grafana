package legacy_storage

import (
	"encoding/json"

	alertingNotify "github.com/grafana/alerting/notify"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func PostableGrafanaReceiverToGrafanaIntegrationConfig(p *apimodels.PostableGrafanaReceiver) *alertingNotify.GrafanaIntegrationConfig {
	return &alertingNotify.GrafanaIntegrationConfig{
		UID:                   p.UID,
		Name:                  p.Name,
		Type:                  p.Type,
		DisableResolveMessage: p.DisableResolveMessage,
		Settings:              json.RawMessage(p.Settings),
		SecureSettings:        p.SecureSettings,
	}
}

func PostableApiReceiverToGrafanaIntegrationConfigs(r *apimodels.PostableApiReceiver) []*alertingNotify.GrafanaIntegrationConfig {
	integrations := make([]*alertingNotify.GrafanaIntegrationConfig, 0, len(r.GrafanaManagedReceivers))
	for _, cfg := range r.GrafanaManagedReceivers {
		integrations = append(integrations, PostableGrafanaReceiverToGrafanaIntegrationConfig(cfg))
	}

	return integrations
}

package notifier

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

func PostableApiReceiverToApiReceiver(r *apimodels.PostableApiReceiver) *alertingNotify.APIReceiver {
	integrations := alertingNotify.GrafanaIntegrations{
		Integrations: make([]*alertingNotify.GrafanaIntegrationConfig, 0, len(r.GrafanaManagedReceivers)),
	}
	for _, cfg := range r.GrafanaManagedReceivers {
		integrations.Integrations = append(integrations.Integrations, PostableGrafanaReceiverToGrafanaIntegrationConfig(cfg))
	}

	return &alertingNotify.APIReceiver{
		ConfigReceiver:      r.Receiver,
		GrafanaIntegrations: integrations,
	}
}

func PostableApiAlertingConfigToApiReceivers(c apimodels.PostableApiAlertingConfig) []*alertingNotify.APIReceiver {
	apiReceivers := make([]*alertingNotify.APIReceiver, 0, len(c.Receivers))
	for _, receiver := range c.Receivers {
		apiReceivers = append(apiReceivers, PostableApiReceiverToApiReceiver(receiver))
	}
	return apiReceivers
}

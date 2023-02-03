package notifier

import (
	"encoding/json"

	alertingNotify "github.com/grafana/alerting/notify"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func PostableGrafanaReceiverToGrafanaReceiver(p *apimodels.PostableGrafanaReceiver) *alertingNotify.GrafanaReceiver {
	return &alertingNotify.GrafanaReceiver{
		UID:                   p.UID,
		Name:                  p.Name,
		Type:                  p.Type,
		DisableResolveMessage: p.DisableResolveMessage,
		Settings:              json.RawMessage(p.Settings),
		SecureSettings:        p.SecureSettings,
	}
}

func PostableApiReceiverToApiReceiver(r *apimodels.PostableApiReceiver) *alertingNotify.APIReceiver {
	receivers := alertingNotify.GrafanaReceivers{
		Receivers: make([]*alertingNotify.GrafanaReceiver, 0, len(r.GrafanaManagedReceivers)),
	}
	for _, receiver := range r.GrafanaManagedReceivers {
		receivers.Receivers = append(receivers.Receivers, PostableGrafanaReceiverToGrafanaReceiver(receiver))
	}

	return &alertingNotify.APIReceiver{
		ConfigReceiver:   r.Receiver,
		GrafanaReceivers: receivers,
	}
}

func PostableApiAlertingConfigToApiReceivers(c apimodels.PostableApiAlertingConfig) []*alertingNotify.APIReceiver {
	apiReceivers := make([]*alertingNotify.APIReceiver, len(c.Receivers))
	for _, receiver := range c.Receivers {
		apiReceivers = append(apiReceivers, PostableApiReceiverToApiReceiver(receiver))
	}
	return apiReceivers
}

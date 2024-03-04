package notifier

import (
	"encoding/json"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/grafana/pkg/components/simplejson"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
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

type DecryptFn = func(value string) string

func PostableToGettableGrafanaReceiver(r *apimodels.PostableGrafanaReceiver, provenance *models.Provenance, decryptFn DecryptFn, listOnly bool) (apimodels.GettableGrafanaReceiver, error) {
	out := apimodels.GettableGrafanaReceiver{
		UID:  r.UID,
		Name: r.Name,
		Type: r.Type,
	}
	if provenance != nil {
		out.Provenance = apimodels.Provenance(*provenance)
	}

	// if we aren't only listing, include the settings in the output
	if !listOnly {
		secureFields := make(map[string]bool, len(r.SecureSettings))
		settings, err := simplejson.NewJson([]byte(r.Settings))
		if err != nil {
			return apimodels.GettableGrafanaReceiver{}, err
		}

		for k, v := range r.SecureSettings {
			decryptedValue := decryptFn(v)
			if decryptedValue == "" {
				continue
			} else {
				settings.Set(k, decryptedValue)
			}
			secureFields[k] = true
		}

		jsonBytes, err := settings.MarshalJSON()
		if err != nil {
			return apimodels.GettableGrafanaReceiver{}, err
		}

		out.Settings = jsonBytes
		out.SecureFields = secureFields
		out.DisableResolveMessage = r.DisableResolveMessage
	}

	return out, nil
}

func PostableToGettableApiReceiver(r *apimodels.PostableApiReceiver, provenances map[string]models.Provenance, decryptFn DecryptFn, listOnly bool) (apimodels.GettableApiReceiver, error) {
	out := apimodels.GettableApiReceiver{
		Receiver: config.Receiver{
			Name: r.Receiver.Name,
		},
	}

	for _, gr := range r.GrafanaManagedReceivers {
		var prov *models.Provenance
		if p, ok := provenances[gr.UID]; ok {
			prov = &p
		}

		gettable, err := PostableToGettableGrafanaReceiver(gr, prov, decryptFn, listOnly)
		if err != nil {
			return apimodels.GettableApiReceiver{}, err
		}
		out.GrafanaManagedReceivers = append(out.GrafanaManagedReceivers, &gettable)
	}

	return out, nil
}

package remote

import (
	"github.com/grafana/alerting/definition"
	alertingNotify "github.com/grafana/alerting/notify"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func ReceiverToPostableApiReceiver(r *models.Receiver) (*apimodels.PostableApiReceiver, error) {
	integrations := apimodels.PostableGrafanaReceivers{
		GrafanaManagedReceivers: make([]*apimodels.PostableGrafanaReceiver, 0, len(r.Integrations)),
	}
	for _, cfg := range r.Integrations {
		postable, err := legacy_storage.IntegrationToPostableGrafanaReceiver(cfg)
		if err != nil {
			return nil, err
		}
		integrations.GrafanaManagedReceivers = append(integrations.GrafanaManagedReceivers, new(definition.PostableGrafanaReceiver(*postable)))
	}

	return &apimodels.PostableApiReceiver{
		Receiver: alertingNotify.ConfigReceiver{
			Name: r.Name,
		},
		PostableGrafanaReceivers: integrations,
	}, nil
}

func PostableApiReceiverToReceiver(postable *apimodels.PostableApiReceiver, provenance models.Provenance, origin models.ResourceOrigin) (*models.Receiver, error) {
	// TODO: Remove this extra indirection when PostableGrafanaReceiversToIntegrations is no longer needed by receiver service.
	integrations, err := legacy_storage.PostableGrafanaReceiversToIntegrations(v1.PostableGrafanaReceiversToModel(postable.GrafanaManagedReceivers))
	if err != nil {
		return nil, err
	}
	if postable.HasMimirIntegrations() {
		mimir, err := legacy_storage.PostableMimirReceiverToIntegrations(postable.Receiver)
		if err != nil {
			return nil, err
		}
		integrations = append(integrations, mimir...)
	}
	r := &models.Receiver{
		UID:          legacy_storage.NameToUid(postable.GetName()), // TODO replace with stable UID.
		Name:         postable.GetName(),
		Integrations: integrations,
		Provenance:   provenance,
		Origin:       origin,
	}
	r.Version = r.Fingerprint()
	return r, nil
}

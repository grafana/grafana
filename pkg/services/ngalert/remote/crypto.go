package remote

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
)

func decryptedGrafanaReceivers(receivers []*definitions.PostableApiReceiver, decryptFn models.DecryptFn) ([]*definitions.PostableApiReceiver, error) {
	decrypted := make([]*definitions.PostableApiReceiver, len(receivers))
	for i, r := range receivers {
		integrations, err := legacy_storage.PostableGrafanaReceiversToIntegrations(notifier.PostableGrafanaReceiversFromAPI(r.GrafanaManagedReceivers))
		if err != nil {
			return nil, err
		}

		// We don't care about any properties here except the integrations we're going to decrypt.
		rcv := &models.Receiver{
			Name:         r.Name,
			Integrations: integrations,
		}

		err = rcv.Decrypt(decryptFn)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt receiver %q: %w", rcv.Name, err)
		}

		postable, err := ReceiverToPostableApiReceiver(rcv)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Receiver %q to APIReceiver: %w", rcv.Name, err)
		}
		decrypted[i] = postable
	}
	return decrypted, nil
}

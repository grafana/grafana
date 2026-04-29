package remote

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
)

func decryptedGrafanaReceivers(receivers []*definitions.PostableApiReceiver, decryptFn models.DecryptFn) ([]*definitions.PostableApiReceiver, error) {
	decrypted := make([]*definitions.PostableApiReceiver, len(receivers))
	for i, r := range receivers {
		// Remove the Imported Mimir integrations as we don't want to convert them into v0 integrations.
		grafanaOnlyReceiver := definitions.PostableApiReceiver{
			Receiver:                 definitions.Receiver{Name: r.Name},
			PostableGrafanaReceivers: r.PostableGrafanaReceivers,
		}
		// We don't care about the provenance here, so we pass ProvenanceNone.
		rcv, err := legacy_storage.PostableApiReceiverToReceiver(&grafanaOnlyReceiver, models.ProvenanceNone, models.ResourceOriginGrafana)
		if err != nil {
			return nil, err
		}

		err = rcv.Decrypt(decryptFn)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt receiver %q: %w", rcv.Name, err)
		}

		postable, err := legacy_storage.ReceiverToPostableApiReceiver(rcv)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Receiver %q to APIReceiver: %w", rcv.Name, err)
		}
		// Put back the Imported Mimir integrations.
		postable.Receiver = r.Receiver
		decrypted[i] = postable
	}
	return decrypted, nil
}

func encryptedGrafanaReceivers(receivers []*definitions.PostableApiReceiver, encryptFn models.EncryptFn) ([]*definitions.PostableApiReceiver, error) {
	encrypted := make([]*definitions.PostableApiReceiver, len(receivers))
	for i, r := range receivers {
		// Remove the Imported Mimir integrations as we don't want to convert them into v0 integrations.
		grafanaOnlyReceiver := definitions.PostableApiReceiver{
			Receiver:                 definitions.Receiver{Name: r.Name},
			PostableGrafanaReceivers: r.PostableGrafanaReceivers,
		}
		// We don't care about the provenance here, so we pass ProvenanceNone.
		rcv, err := legacy_storage.PostableApiReceiverToReceiver(&grafanaOnlyReceiver, models.ProvenanceNone, models.ResourceOriginGrafana)
		if err != nil {
			return nil, err
		}

		err = rcv.Encrypt(encryptFn)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt receiver %q: %w", rcv.Name, err)
		}

		postable, err := legacy_storage.ReceiverToPostableApiReceiver(rcv)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Receiver %q to APIReceiver: %w", rcv.Name, err)
		}
		// Put back the Imported Mimir integrations.
		postable.Receiver = r.Receiver
		encrypted[i] = postable
	}
	return encrypted, nil
}

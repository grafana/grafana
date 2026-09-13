package remote

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func decryptedGrafanaReceivers(receivers []*definitions.PostableApiReceiver, decryptFn models.DecryptFn) ([]*definitions.PostableApiReceiver, error) {
	decrypted := make([]*definitions.PostableApiReceiver, len(receivers))
	for i, r := range receivers {
		// We don't care about the provenance here, so we pass ProvenanceNone.
		rcv, err := PostableApiReceiverToReceiver(r, models.ProvenanceNone, models.ResourceOriginGrafana)
		if err != nil {
			return nil, err
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

func encryptedGrafanaReceivers(receivers []*definitions.PostableApiReceiver, encryptFn models.EncryptFn) ([]*definitions.PostableApiReceiver, error) {
	encrypted := make([]*definitions.PostableApiReceiver, len(receivers))
	for i, r := range receivers {
		// We don't care about the provenance here, so we pass ProvenanceNone.
		rcv, err := PostableApiReceiverToReceiver(r, models.ProvenanceNone, models.ResourceOriginGrafana)
		if err != nil {
			return nil, err
		}

		err = rcv.Encrypt(encryptFn)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt receiver %q: %w", rcv.Name, err)
		}

		postable, err := ReceiverToPostableApiReceiver(rcv)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Receiver %q to APIReceiver: %w", rcv.Name, err)
		}
		encrypted[i] = postable
	}
	return encrypted, nil
}

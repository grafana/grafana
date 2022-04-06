package notifier

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets"
)

type Encryption interface {
	LoadSecureSettings(ctx context.Context, orgId int64, receivers []*definitions.PostableApiReceiver) error
	getDecryptedSecret(r *definitions.PostableGrafanaReceiver, key string) (string, error)
	Encrypt(ctx context.Context, payload []byte, opt secrets.EncryptionOptions) ([]byte, error)
}

type encryptionImpl struct {
	secrets secrets.Service
	configs configurationStore
}

func NewEncryption(secrets secrets.Service, configs configurationStore) Encryption {
	return &encryptionImpl{
		secrets: secrets,
		configs: configs,
	}
}

func (e *encryptionImpl) LoadSecureSettings(ctx context.Context, orgId int64, receivers []*definitions.PostableApiReceiver) error {
	// Get the last known working configuration
	query := models.GetLatestAlertmanagerConfigurationQuery{OrgID: orgId}
	if err := e.configs.GetLatestAlertmanagerConfiguration(ctx, &query); err != nil {
		// If we don't have a configuration there's nothing for us to know and we should just continue saving the new one
		if !errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			return fmt.Errorf("failed to get latest configuration: %w", err)
		}
	}

	currentReceiverMap := make(map[string]*definitions.PostableGrafanaReceiver)
	if query.Result != nil {
		currentConfig, err := Load([]byte(query.Result.AlertmanagerConfiguration))
		if err != nil {
			return fmt.Errorf("failed to load latest configuration: %w", err)
		}
		currentReceiverMap = currentConfig.GetGrafanaReceiverMap()
	}

	// Copy the previously known secure settings
	for i, r := range receivers {
		for j, gr := range r.PostableGrafanaReceivers.GrafanaManagedReceivers {
			if gr.UID == "" { // new receiver
				continue
			}

			cgmr, ok := currentReceiverMap[gr.UID]
			if !ok {
				// it tries to update a receiver that didn't previously exist
				return UnknownReceiverError{UID: gr.UID}
			}

			// frontend sends only the secure settings that have to be updated
			// therefore we have to copy from the last configuration only those secure settings not included in the request
			for key := range cgmr.SecureSettings {
				_, ok := gr.SecureSettings[key]
				if !ok {
					decryptedValue, err := e.getDecryptedSecret(cgmr, key)
					if err != nil {
						return fmt.Errorf("failed to decrypt stored secure setting: %s: %w", key, err)
					}

					if receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings == nil {
						receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings = make(map[string]string, len(cgmr.SecureSettings))
					}

					receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings[key] = decryptedValue
				}
			}
		}
	}
	return nil
}

func (e *encryptionImpl) getDecryptedSecret(r *definitions.PostableGrafanaReceiver, key string) (string, error) {
	storedValue, ok := r.SecureSettings[key]
	if !ok {
		return "", nil
	}

	decodeValue, err := base64.StdEncoding.DecodeString(storedValue)
	if err != nil {
		return "", err
	}

	decryptedValue, err := e.secrets.Decrypt(context.Background(), decodeValue)
	if err != nil {
		return "", err
	}

	return string(decryptedValue), nil
}

func (e *encryptionImpl) Encrypt(ctx context.Context, payload []byte, opt secrets.EncryptionOptions) ([]byte, error) {
	return e.secrets.Encrypt(ctx, payload, opt)
}

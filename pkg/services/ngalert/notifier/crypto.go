package notifier

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets"
)

// Crypto allows decryption of Alertmanager Configuration and encryption of arbitrary payloads.
type Crypto interface {
	LoadSecureSettings(ctx context.Context, orgId int64, receivers []*definitions.PostableApiReceiver) error
	Encrypt(ctx context.Context, payload []byte, opt secrets.EncryptionOptions) ([]byte, error)

	getDecryptedSecret(r *definitions.PostableGrafanaReceiver, key string) (string, error)
	ProcessSecureSettings(ctx context.Context, orgId int64, recvs []*definitions.PostableApiReceiver) error
}

// alertmanagerCrypto implements decryption of Alertmanager configuration and encryption of arbitrary payloads based on Grafana's encryptions.
type alertmanagerCrypto struct {
	secrets secrets.Service
	configs configurationStore
	log     log.Logger
}

func NewCrypto(secrets secrets.Service, configs configurationStore, log log.Logger) Crypto {
	return &alertmanagerCrypto{
		secrets: secrets,
		configs: configs,
		log:     log,
	}
}

// ProcessSecureSettings encrypts new secure settings and loads existing secure settings from the database.
func (c *alertmanagerCrypto) ProcessSecureSettings(ctx context.Context, orgId int64, recvs []*definitions.PostableApiReceiver) error {
	// First, we encrypt the new or updated secure settings. Then, we load the existing secure settings from the database
	// and add back any that weren't updated.
	// We perform these steps in this order to ensure the hash of the secure settings remains stable when no secure
	// settings were modified.
	if err := EncryptReceiverConfigs(recvs, func(ctx context.Context, payload []byte) ([]byte, error) {
		return c.Encrypt(ctx, payload, secrets.WithoutScope())
	}); err != nil {
		return fmt.Errorf("failed to encrypt receivers: %w", err)
	}

	if err := c.LoadSecureSettings(ctx, orgId, recvs); err != nil {
		return err
	}

	return nil
}

// EncryptReceiverConfigs encrypts all SecureSettings in the given receivers.
func EncryptReceiverConfigs(c []*definitions.PostableApiReceiver, encrypt definitions.EncryptFn) error {
	return encryptReceiverConfigs(c, encrypt, true)
}

func EncryptReceiverConfigSettings(c []*definitions.PostableApiReceiver, encrypt definitions.EncryptFn) error {
	return encryptReceiverConfigs(c, encrypt, false)
}

// encryptReceiverConfigs encrypts all SecureSettings in the given receivers.
// encryptExisting determines whether to encrypt existing secure settings.
func encryptReceiverConfigs(c []*definitions.PostableApiReceiver, encrypt definitions.EncryptFn, encryptExisting bool) error {
	// encrypt secure settings for storing them in DB
	for _, r := range c {
		switch r.Type() {
		case definitions.GrafanaReceiverType:
			for _, gr := range r.PostableGrafanaReceivers.GrafanaManagedReceivers {
				if encryptExisting {
					for k, v := range gr.SecureSettings {
						encryptedData, err := encrypt(context.Background(), []byte(v))
						if err != nil {
							return fmt.Errorf("failed to encrypt secure settings: %w", err)
						}
						gr.SecureSettings[k] = base64.StdEncoding.EncodeToString(encryptedData)
					}
				}

				if len(gr.Settings) > 0 {
					// We need to parse the settings to check for secret keys. If we find any, we encrypt them and
					// store them in SecureSettings. This can happen from incorrect configuration or when an integration
					// definition is updated to make a field secure.
					settings := make(map[string]any)
					if err := json.Unmarshal(gr.Settings, &settings); err != nil {
						return fmt.Errorf("integration '%s' of receiver '%s' has settings that cannot be parsed as JSON: %w", gr.Type, gr.Name, err)
					}

					secretKeys, err := channels_config.GetSecretKeysForContactPointType(gr.Type)
					if err != nil {
						return fmt.Errorf("failed to get secret keys for contact point type %s: %w", gr.Type, err)
					}

					secureSettings := gr.SecureSettings
					if secureSettings == nil {
						secureSettings = make(map[string]string)
					}

					settingsChanged := false
					secureSettingsChanged := false
					for _, secretKey := range secretKeys {
						settingsValue, ok := settings[secretKey]
						if !ok {
							continue
						}

						// Secrets should not be stored in settings regardless.
						delete(settings, secretKey)
						settingsChanged = true

						// If the secret is already encrypted, we don't need to encrypt it again.
						if _, ok := secureSettings[secretKey]; ok {
							continue
						}

						if strVal, isString := settingsValue.(string); isString {
							encrypted, err := encrypt(context.Background(), []byte(strVal))
							if err != nil {
								return fmt.Errorf("failed to encrypt secure settings: %w", err)
							}
							secureSettings[secretKey] = base64.StdEncoding.EncodeToString(encrypted)
							secureSettingsChanged = true
						}
					}

					// Defensive checks to limit the risk of unintentional edge case changes in this legacy API.
					if settingsChanged {
						// If we removed any secret keys from settings, we need to save the updated settings.
						jsonBytes, err := json.Marshal(settings)
						if err != nil {
							return err
						}
						gr.Settings = jsonBytes
					}
					if secureSettingsChanged {
						// If we added any secure settings, we need to save the updated secure settings.
						gr.SecureSettings = secureSettings
					}
				}
			}
		default:
		}
	}
	return nil
}

// LoadSecureSettings adds the corresponding unencrypted secrets stored to the list of input receivers.
func (c *alertmanagerCrypto) LoadSecureSettings(ctx context.Context, orgId int64, receivers []*definitions.PostableApiReceiver) error {
	// Get the last known working configuration.
	amConfig, err := c.configs.GetLatestAlertmanagerConfiguration(ctx, orgId)
	if err != nil {
		// If we don't have a configuration there's nothing for us to know and we should just continue saving the new one.
		if !errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			return fmt.Errorf("failed to get latest configuration: %w", err)
		}
	}

	currentReceiverMap := make(map[string]*definitions.PostableGrafanaReceiver)
	if amConfig != nil {
		currentConfig, err := Load([]byte(amConfig.AlertmanagerConfiguration))
		// If the current config is un-loadable, treat it as if it never existed. Providing a new, valid config should be able to "fix" this state.
		if err != nil {
			c.log.Warn("Last known alertmanager configuration was invalid. Overwriting...")
		} else {
			// First we encrypt the secure settings in the existing configuration.
			// This is done to ensure that any secure settings incorrectly stored in Settings are encrypted and moved to
			// SecureSettings. This can happen if an integration definition is updated to make a field secure.
			if err := EncryptReceiverConfigSettings(currentConfig.AlertmanagerConfig.Receivers, func(ctx context.Context, payload []byte) ([]byte, error) {
				return c.Encrypt(ctx, payload, secrets.WithoutScope())
			}); err != nil {
				return fmt.Errorf("failed to encrypt receivers: %w", err)
			}
			currentReceiverMap = currentConfig.GetGrafanaReceiverMap()
		}
	}

	// Copy the previously known secure settings.
	for i, r := range receivers {
		for j, gr := range r.PostableGrafanaReceivers.GrafanaManagedReceivers {
			if gr.UID == "" { // new receiver
				continue
			}

			cgmr, ok := currentReceiverMap[gr.UID]
			if !ok {
				// It tries to update a receiver that didn't previously exist
				return UnknownReceiverError{UID: gr.UID}
			}

			// Frontend sends only the secure settings that have to be updated
			// Therefore we have to copy from the last configuration only those secure settings not included in the request
			for key, encryptedValue := range cgmr.SecureSettings {
				_, ok := gr.SecureSettings[key]
				if !ok {
					if receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings == nil {
						receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings = make(map[string]string, len(cgmr.SecureSettings))
					}
					receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings[key] = encryptedValue
				}
			}
		}
	}
	return nil
}

func (c *alertmanagerCrypto) getDecryptedSecret(r *definitions.PostableGrafanaReceiver, key string) (string, error) {
	storedValue, ok := r.SecureSettings[key]
	if !ok {
		return "", nil
	}

	decodeValue, err := base64.StdEncoding.DecodeString(storedValue)
	if err != nil {
		return "", err
	}

	decryptedValue, err := c.secrets.Decrypt(context.Background(), decodeValue)
	if err != nil {
		return "", err
	}

	return string(decryptedValue), nil
}

// Encrypt delegates encryption to secrets.Service.
func (c *alertmanagerCrypto) Encrypt(ctx context.Context, payload []byte, opt secrets.EncryptionOptions) ([]byte, error) {
	return c.secrets.Encrypt(ctx, payload, opt)
}

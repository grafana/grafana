package notifier

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets"
)

const (
	// encryptedContentPrefix is a marker that identifies encrypted Alertmanager configurations.
	// When this prefix is present at the beginning of a configuration string:
	// 1. During encryption: It indicates the content is already encrypted and should be skipped
	// 2. During decryption: It indicates the content (minus this prefix) should be base64 decoded
	//    and then decrypted using the secrets service
	// This prefix helps maintain idempotency in encryption/decryption operations.
	cryptoPrefix = "crypto_"
)

// Crypto allows decryption of Alertmanager Configuration and encryption of arbitrary payloads.
type Crypto interface {
	Encrypt(ctx context.Context, payload []byte, opt secrets.EncryptionOptions) ([]byte, error)
	Decrypt(ctx context.Context, payload []byte) ([]byte, error)
	EncryptExtraConfigs(ctx context.Context, config *definitions.PostableUserConfig) error
	DecryptExtraConfigs(ctx context.Context, config *definitions.PostableUserConfig) error

	getDecryptedSecret(r *definitions.PostableGrafanaReceiver, key string) (string, error)
}

// alertmanagerCrypto implements decryption of Alertmanager configuration and encryption of arbitrary payloads based on Grafana's encryptions.
type alertmanagerCrypto struct {
	*ExtraConfigsCrypto
	configs configurationStore
	log     log.Logger
}

func NewCrypto(secrets secrets.Service, configs configurationStore, log log.Logger) Crypto {
	return &alertmanagerCrypto{
		ExtraConfigsCrypto: NewExtraConfigsCrypto(secrets),
		configs:            configs,
		log:                log,
	}
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
		for _, gr := range r.GrafanaManagedReceivers {
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

				v := schema.V1
				if gr.Version != "" {
					v = schema.Version(gr.Version)
				}
				typeSchema, ok := alertingNotify.GetSchemaVersionForIntegration(schema.IntegrationType(gr.Type), v)
				if !ok {
					return fmt.Errorf("failed to get secret keys for contact point type %s", gr.Type)
				}
				secretPaths := typeSchema.GetSecretFieldsPaths()
				secureSettings := gr.SecureSettings
				if secureSettings == nil {
					secureSettings = make(map[string]string)
				}

				settingsChanged := false
				secureSettingsChanged := false
				for _, secretPath := range secretPaths {
					secretKey := secretPath.String()
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

func (c *alertmanagerCrypto) Decrypt(ctx context.Context, payload []byte) ([]byte, error) {
	return c.secrets.Decrypt(ctx, payload)
}

type ExtraConfigsCrypto struct {
	secrets secretService
}

func NewExtraConfigsCrypto(secrets secretService) *ExtraConfigsCrypto {
	return &ExtraConfigsCrypto{
		secrets: secrets,
	}
}

func (c *ExtraConfigsCrypto) EncryptExtraConfigs(ctx context.Context, config *definitions.PostableUserConfig) error {
	for i := range config.ExtraConfigs {
		// If it has prefix, consider it encrypted already
		if strings.HasPrefix(config.ExtraConfigs[i].AlertmanagerConfig, cryptoPrefix) {
			continue
		}

		encryptedValue, err := c.secrets.Encrypt(ctx, []byte(config.ExtraConfigs[i].AlertmanagerConfig), secrets.WithoutScope())
		if err != nil {
			return fmt.Errorf("failed to encrypt extra configuration: %w", err)
		}

		config.ExtraConfigs[i].AlertmanagerConfig = cryptoPrefix + base64.StdEncoding.EncodeToString(encryptedValue)
	}

	return nil
}

func (c *ExtraConfigsCrypto) DecryptExtraConfigs(ctx context.Context, config *definitions.PostableUserConfig) error {
	for i := range config.ExtraConfigs {
		// If it does not have prefix, consider it decrypted already
		if !strings.HasPrefix(config.ExtraConfigs[i].AlertmanagerConfig, cryptoPrefix) {
			continue
		}
		// Check if the config is encrypted by trying to base64 decode it
		encryptedValue, err := base64.StdEncoding.DecodeString(config.ExtraConfigs[i].AlertmanagerConfig[len(cryptoPrefix):])
		if err != nil {
			return fmt.Errorf("failed to decode extra configuration: %w", err)
		}

		decryptedValue, err := c.secrets.Decrypt(ctx, encryptedValue)
		if err != nil {
			return fmt.Errorf("failed to decrypt extra configuration: %w", err)
		}

		config.ExtraConfigs[i].AlertmanagerConfig = string(decryptedValue)
	}

	return nil
}

// DecryptIntegrationSettings returns a function to decrypt integration settings.
func DecryptIntegrationSettings(ctx context.Context, ss secretService) models.DecryptFn {
	return func(value string) (string, error) {
		decoded, err := base64.StdEncoding.DecodeString(value)
		if err != nil {
			return "", err
		}
		decrypted, err := ss.Decrypt(ctx, decoded)
		if err != nil {
			return "", err
		}
		return string(decrypted), nil
	}
}

// EncryptIntegrationSettings returns a function to encrypt integration settings.
func EncryptIntegrationSettings(ctx context.Context, ss secretService) models.EncryptFn {
	return func(payload string) (string, error) {
		encrypted, err := ss.Encrypt(ctx, []byte(payload), secrets.WithoutScope())
		if err != nil {
			return "", err
		}
		return base64.StdEncoding.EncodeToString(encrypted), nil
	}
}

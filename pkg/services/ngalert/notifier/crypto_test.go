package notifier

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
)

func TestEncryptExtraConfigs(t *testing.T) {
	config := "plain-text-config"
	encryptedConfig := base64.StdEncoding.EncodeToString([]byte(config))
	tests := []struct {
		name           string
		inputConfig    string
		expectedConfig string
	}{
		{
			name:           "Encrypts unencrypted configs",
			inputConfig:    config,
			expectedConfig: cryptoPrefix + encryptedConfig,
		},
		{
			name:           "Skips already encrypted configs",
			inputConfig:    cryptoPrefix + "very-encrypted-data",
			expectedConfig: cryptoPrefix + "very-encrypted-data",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := fakes.NewFakeSecretsService()

			c := &alertmanagerCrypto{
				ExtraConfigsCrypto: &ExtraConfigsCrypto{
					secrets: m,
				},
			}

			cfg := &v1.AMConfigV1{
				ExtraConfigs: []v1.ExtraConfiguration{
					{AlertmanagerConfig: tt.inputConfig},
				},
			}

			err := c.EncryptExtraConfigs(context.Background(), cfg)

			require.NoError(t, err)
			require.Equal(t, tt.expectedConfig, cfg.ExtraConfigs[0].AlertmanagerConfig)
		})
	}
}

func TestEncryptReceiverConfigSettings_MovesSecretsFromSettings(t *testing.T) {
	// Identity "encryption" so we can assert on the stored value (base64 of the plaintext).
	encrypt := func(_ context.Context, payload []byte) ([]byte, error) {
		return payload, nil
	}

	const secretValue = "my-integration-key"
	encryptedSecret := base64.StdEncoding.EncodeToString([]byte(secretValue))

	tests := []struct {
		name                   string
		settings               string
		secureSettings         map[string]string
		expectedSecureSettings map[string]string
		expectedSettingsKeys   []string
		removedSettingsKeys    []string
	}{
		{
			name:                   "secret with exact schema casing is moved to secure settings",
			settings:               `{"integrationKey":"my-integration-key","severity":"critical"}`,
			expectedSecureSettings: map[string]string{"integrationKey": encryptedSecret},
			expectedSettingsKeys:   []string{"severity"},
			removedSettingsKeys:    []string{"integrationKey"},
		},
		{
			name:                   "secret with non-canonical casing is matched case-insensitively and moved",
			settings:               `{"integrationkey":"my-integration-key","severity":"critical"}`,
			expectedSecureSettings: map[string]string{"integrationkey": encryptedSecret},
			expectedSettingsKeys:   []string{"severity"},
			removedSettingsKeys:    []string{"integrationkey"},
		},
		{
			name:                   "secret already present in secure settings is removed from settings but not re-encrypted",
			settings:               `{"INTEGRATIONKEY":"my-integration-key"}`,
			secureSettings:         map[string]string{"INTEGRATIONKEY": "already-encrypted"},
			expectedSecureSettings: map[string]string{"INTEGRATIONKEY": "already-encrypted"},
			removedSettingsKeys:    []string{"INTEGRATIONKEY"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gr := &v1.PostableGrafanaReceiver{
				UID:            "uid",
				Name:           "pd",
				Type:           "pagerduty",
				Settings:       definitions.RawMessage(tt.settings),
				SecureSettings: tt.secureSettings,
			}
			receivers := []*v1.PostableApiReceiver{
				{
					Receiver: definitions.Receiver{Name: "pd"},
					PostableGrafanaReceivers: v1.PostableGrafanaReceivers{
						GrafanaManagedReceivers: []*v1.PostableGrafanaReceiver{gr},
					},
				},
			}

			err := EncryptReceiverConfigSettings(receivers, encrypt)
			require.NoError(t, err)

			require.Equal(t, tt.expectedSecureSettings, gr.SecureSettings)

			parsed := map[string]any{}
			require.NoError(t, json.Unmarshal(gr.Settings, &parsed))
			for _, k := range tt.expectedSettingsKeys {
				require.Contains(t, parsed, k)
			}
			for _, k := range tt.removedSettingsKeys {
				require.NotContains(t, parsed, k)
			}
		})
	}
}

func TestDecryptExtraConfigs(t *testing.T) {
	decryptedData := "derypted-data"
	decryptedDataBase64 := base64.StdEncoding.EncodeToString([]byte(decryptedData))
	tests := []struct {
		name           string
		inputConfig    string
		expectedError  string
		expectedConfig string
	}{
		{
			name:           "Decrypts encrypted configs",
			inputConfig:    cryptoPrefix + decryptedDataBase64,
			expectedConfig: decryptedData,
		},
		{
			name:           "Skips already encrypted configs",
			inputConfig:    "very-decrypted-data",
			expectedConfig: "very-decrypted-data",
		},
		{
			name:          "Fails if not base64 encoded",
			inputConfig:   cryptoPrefix + "plain-text-config",
			expectedError: "failed to decode extra configuration",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := fakes.NewFakeSecretsService()
			c := &alertmanagerCrypto{
				ExtraConfigsCrypto: &ExtraConfigsCrypto{
					secrets: m,
				},
			}

			cfg := &v1.AMConfigV1{
				ExtraConfigs: []v1.ExtraConfiguration{
					{AlertmanagerConfig: tt.inputConfig},
				},
			}

			err := c.DecryptExtraConfigs(context.Background(), cfg)

			if tt.expectedError != "" {
				require.ErrorContains(t, err, tt.expectedError)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.expectedConfig, cfg.ExtraConfigs[0].AlertmanagerConfig)
		})
	}
}

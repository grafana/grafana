package notifier

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
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

			cfg := &definitions.PostableUserConfig{
				ExtraConfigs: []definitions.ExtraConfiguration{
					{AlertmanagerConfig: tt.inputConfig},
				},
			}

			err := c.EncryptExtraConfigs(context.Background(), cfg)

			require.NoError(t, err)
			require.Equal(t, tt.expectedConfig, cfg.ExtraConfigs[0].AlertmanagerConfig)
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

			cfg := &definitions.PostableUserConfig{
				ExtraConfigs: []definitions.ExtraConfiguration{
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

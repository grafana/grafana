package notifier

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"testing"

	"github.com/grafana/alerting/receivers/schema"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
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

func TestLoadSecureSettings_ReceiverNameCheck(t *testing.T) {
	const orgID = int64(1)
	const receiverName = "my-receiver"
	const integrationUID = "test-integration-uid"

	savedConfig := buildSavedConfig(t, receiverName, integrationUID)
	configStore := NewFakeConfigStore(t, map[int64]*models.AlertConfiguration{
		orgID: savedConfig,
	})

	secretsSvc := fakes.NewFakeSecretsService()
	crypto := &alertmanagerCrypto{
		ExtraConfigsCrypto: NewExtraConfigsCrypto(secretsSvc),
		configs:            configStore,
		log:                log.NewNopLogger(),
	}

	authorizeProtected := AuthorizeProtectedFn(func(_ string, _ []schema.IntegrationFieldPath) error { return nil })

	t.Run("succeeds when receiver name matches DB", func(t *testing.T) {
		receivers := []*definitions.PostableApiReceiver{
			buildTestReceiver(receiverName, integrationUID),
		}
		err := crypto.LoadSecureSettings(context.Background(), orgID, receivers, authorizeProtected)
		require.NoError(t, err)
	})

	t.Run("succeeds when receiver name is empty", func(t *testing.T) {
		receivers := []*definitions.PostableApiReceiver{
			buildTestReceiver("", integrationUID),
		}
		err := crypto.LoadSecureSettings(context.Background(), orgID, receivers, authorizeProtected)
		require.NoError(t, err)
	})

	t.Run("fails when receiver name is non-empty and does not match DB", func(t *testing.T) {
		receivers := []*definitions.PostableApiReceiver{
			buildTestReceiver("wrong-receiver-name", integrationUID),
		}
		err := crypto.LoadSecureSettings(context.Background(), orgID, receivers, authorizeProtected)
		require.ErrorAs(t, err, &UnknownReceiverError{})
	})
}

func buildSavedConfig(t *testing.T, receiverName, integrationUID string) *models.AlertConfiguration {
	t.Helper()

	raw, err := json.Marshal(map[string]interface{}{
		"template_files": nil,
		"alertmanager_config": map[string]interface{}{
			"route": map[string]interface{}{
				"receiver": receiverName,
			},
			"receivers": []interface{}{
				map[string]interface{}{
					"name": receiverName,
					"grafana_managed_receiver_configs": []interface{}{
						map[string]interface{}{
							"uid":  integrationUID,
							"name": receiverName,
							"type": "email",
							"disableResolveMessage": false,
							"settings":              map[string]interface{}{"addresses": "test@example.com"},
						},
					},
				},
			},
		},
	})
	require.NoError(t, err)

	return &models.AlertConfiguration{
		AlertmanagerConfiguration: string(raw),
		OrgID:                     1,
	}
}

func buildTestReceiver(receiverName, integrationUID string) *definitions.PostableApiReceiver {
	recv := &definitions.PostableApiReceiver{}
	recv.Name = receiverName
	recv.GrafanaManagedReceivers = []*definitions.PostableGrafanaReceiver{
		{
			UID:  integrationUID,
			Name: receiverName,
			Type: "email",
		},
	}
	return recv
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

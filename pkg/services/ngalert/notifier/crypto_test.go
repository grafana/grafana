package notifier

import (
	"context"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
)

func setupCrypto(t *testing.T) *alertmanagerCrypto {
	sqlStore := db.InitTestDB(t)
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
	return &alertmanagerCrypto{secrets: secretsService}
}

func TestCryptoExtraConfigs(t *testing.T) {
	crypto := setupCrypto(t)
	ctx := context.Background()

	testCases := []struct {
		name           string
		extraConfigs   []definitions.ExtraConfiguration
		validateResult func(t *testing.T, original, result []definitions.ExtraConfiguration)
	}{
		{
			name: "encrypt-decrypt round trip",
			extraConfigs: []definitions.ExtraConfiguration{
				{
					Identifier:         "config1",
					AlertmanagerConfig: "route:\n  receiver: receiver1",
				},
				{
					Identifier:         "config2",
					AlertmanagerConfig: `{"route": {"receiver": "receiver2"}}`,
				},
			},
			validateResult: func(t *testing.T, original, result []definitions.ExtraConfiguration) {
				require.ElementsMatch(t, original, result)
			},
		},
		{
			name:         "empty extra configs",
			extraConfigs: []definitions.ExtraConfiguration{},
			validateResult: func(t *testing.T, original, result []definitions.ExtraConfiguration) {
				require.Len(t, result, 0)
			},
		},
		{
			name:         "nil extra configs",
			extraConfigs: nil,
			validateResult: func(t *testing.T, original, result []definitions.ExtraConfiguration) {
				require.Nil(t, result)
			},
		},
		{
			name: "empty alertmanager config",
			extraConfigs: []definitions.ExtraConfiguration{
				{
					Identifier:         "empty-config",
					AlertmanagerConfig: "",
				},
			},
			validateResult: func(t *testing.T, original, result []definitions.ExtraConfiguration) {
				require.Equal(t, "", result[0].AlertmanagerConfig)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			originalConfigs := slices.Clone(tc.extraConfigs)

			config := &definitions.PostableUserConfig{
				ExtraConfigs: tc.extraConfigs,
			}

			err := crypto.EncryptExtraConfigs(ctx, config)
			require.NoError(t, err)

			err = crypto.DecryptExtraConfigs(ctx, config)
			require.NoError(t, err)

			tc.validateResult(t, originalConfigs, config.ExtraConfigs)
		})
	}

	t.Run("skips already encrypted data", func(t *testing.T) {
		config := &definitions.PostableUserConfig{
			ExtraConfigs: []definitions.ExtraConfiguration{
				{
					Identifier:         "test-config",
					AlertmanagerConfig: "route:\n  receiver: test",
				},
			},
		}

		err := crypto.EncryptExtraConfigs(ctx, config)
		require.NoError(t, err)
		encryptedOnce := config.ExtraConfigs[0].AlertmanagerConfig

		// Encrypt again, should not change
		err = crypto.EncryptExtraConfigs(ctx, config)
		require.NoError(t, err)
		require.Equal(t, encryptedOnce, config.ExtraConfigs[0].AlertmanagerConfig)
	})
}

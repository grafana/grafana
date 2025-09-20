package configchecks

import (
	"context"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"
)

func TestSecretsManagerConfigStepSuccess(t *testing.T) {
	step := &secretsManagerConfigStep{
		secretsManagerProviders: map[string]map[string]string{},
	}

	errs, err := step.Run(context.Background(), logging.DefaultLogger, nil, "secrets_manager.encryption")
	require.NoError(t, err)
	require.Len(t, errs, 0)
}

func TestSecretsManagerConfigStepFailure(t *testing.T) {
	secretsManagerProviders := map[string]map[string]string{
		"secret_key.v1": {
			"secret_key": defaultSecretsManagerSecretKey,
		},
		"secret_key.v2": {
			"secret_key": defaultSecretsManagerSecretKey,
		},
		"secret_key.v3": {
			"secret_key": "SOMEOTHERKEY",
		},
		"aws_kms.v1": {
			"access_key": "SOMEAWSKEY",
		},
	}

	step := &secretsManagerConfigStep{
		secretsManagerProviders: secretsManagerProviders,
	}

	for providerName := range secretsManagerProviders {
		errs, err := step.Run(context.Background(), logging.DefaultLogger, nil, "secrets_manager.encryption."+providerName)
		require.NoError(t, err)
		if providerName == "secret_key.v1" || providerName == "secret_key.v2" {
			require.Len(t, errs, 1)
		} else {
			require.Len(t, errs, 0)
		}
	}
}

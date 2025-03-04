package decrypt

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type DecryptClientFunc struct {
	decryptStorage contracts.DecryptStorage
}

var _ contracts.DecryptClient = (*DecryptClientFunc)(nil)

// ProvideDecryptClientFunc for services that want to decrypt secure values in single-tenant mode.
func ProvideDecryptClientFunc(features featuremgmt.FeatureToggles, decryptStorage contracts.DecryptStorage) (contracts.DecryptClient, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &DecryptClientFunc{}, nil
	}

	return &DecryptClientFunc{
		decryptStorage: decryptStorage,
	}, nil
}

// Decrypt a series of `names` from a `namespace`.
func (d *DecryptClientFunc) Decrypt(ctx context.Context, namespace string, names []string) (map[string]string, error) {
	// TODO: Auth not needed because this is in process?

	decryptedValues := make(map[string]string, len(names))

	for _, name := range names {
		decryptedValue, err := d.decryptStorage.Decrypt(ctx, xkube.Namespace(namespace), name)
		if err != nil {
			return nil, errors.New("failed to decrypt value") // Do not leak information about the error.
		}

		decryptedValues[name] = decryptedValue.DangerouslyExposeAndConsumeValue()
	}

	return decryptedValues, nil
}

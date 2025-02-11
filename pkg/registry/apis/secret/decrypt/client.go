package decrypt

import (
	"context"

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
func (d *DecryptClientFunc) Decrypt(ctx context.Context, namespace string, names ...string) (map[string]string, error) {
	// TODO: ctx auth stuff.

	decryptedValues := make(map[string]string, len(names))

	for _, name := range names {
		decryptedValue, err := d.decryptStorage.Decrypt(ctx, xkube.NameNamespace{
			Name:      name,
			Namespace: xkube.Namespace(namespace),
		})
		if err != nil {
			// TODO: Return error depending on the situation...
			// For now return an empty value and continue.
			decryptedValues[name] = ""

			continue
		}

		decryptedValues[name] = decryptedValue.DangerouslyExposeAndConsumeValue() // TODO: validate we want it to behave like this.
	}

	return decryptedValues, nil
}

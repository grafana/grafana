package metadata

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana-app-sdk/logging"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// TODO: this should be a "decrypt" service rather, so that other services can wire and call it.
func ProvideDecryptStorage(
	features featuremgmt.FeatureToggles,
	keeperService contracts.KeeperService,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	decryptAuthorizer contracts.DecryptAuthorizer,
) (contracts.DecryptStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &decryptStorage{}, nil
	}

	if decryptAuthorizer == nil {
		return nil, fmt.Errorf("a decrypt authorizer is required")
	}

	return &decryptStorage{
		keeperMetadataStorage:      keeperMetadataStorage,
		keeperService:              keeperService,
		secureValueMetadataStorage: secureValueMetadataStorage,
		decryptAuthorizer:          decryptAuthorizer,
	}, nil
}

// decryptStorage is the actual implementation of the decrypt storage.
type decryptStorage struct {
	keeperMetadataStorage      contracts.KeeperMetadataStorage
	keeperService              contracts.KeeperService
	secureValueMetadataStorage contracts.SecureValueMetadataStorage
	decryptAuthorizer          contracts.DecryptAuthorizer
}

// Decrypt decrypts a secure value from the keeper.
func (s *decryptStorage) Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (_ secretv0alpha1.ExposedSecureValue, decryptErr error) {
	var decrypterIdentity string
	// TEMPORARY: While we evaluate all of our auditing needs, provide one for decrypt operations.
	defer func() {
		if decryptErr == nil {
			logging.FromContext(ctx).Info("Audit log:", "operation", "decrypt_secret_success", "namespace", namespace, "secret_name", name, "decrypter_identity", decrypterIdentity)
		} else {
			logging.FromContext(ctx).Info("Audit log:", "operation", "decrypt_secret_error", "namespace", namespace, "secret_name", name, "decrypter_identity", decrypterIdentity, "error", decryptErr)
		}
	}()

	// Basic authn check before reading a secure value metadata, it is here on purpose.
	if _, ok := claims.AuthInfoFrom(ctx); !ok {
		return "", contracts.ErrDecryptNotAuthorized
	}

	// The auth token will not necessarily have the permission to read the secure value metadata,
	// but we still need to do it to inspect the `decrypters` field, hence the actual `authorize`
	// function call happens after this.
	sv, err := s.secureValueMetadataStorage.ReadForDecrypt(ctx, namespace, name)
	if err != nil {
		return "", contracts.ErrDecryptNotFound
	}

	decrypterIdentity, authorized := s.decryptAuthorizer.Authorize(ctx, sv.Decrypters)
	if !authorized {
		return "", contracts.ErrDecryptNotAuthorized
	}

	keeperConfig, err := s.keeperMetadataStorage.GetKeeperConfig(ctx, namespace.String(), sv.Keeper)
	if err != nil {
		return "", contracts.ErrDecryptFailed
	}

	keeper, err := s.keeperService.KeeperForConfig(keeperConfig)
	if err != nil {
		return "", contracts.ErrDecryptFailed
	}

	exposedValue, err := keeper.Expose(ctx, keeperConfig, namespace.String(), contracts.ExternalID(sv.ExternalID))
	if err != nil {
		return "", contracts.ErrDecryptFailed
	}

	return exposedValue, nil
}

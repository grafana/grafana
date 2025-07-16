package secrets

import (
	"context"
	"errors"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanasecrets "github.com/grafana/grafana/pkg/services/secrets"
)

func ProvideRepositorySecrets(
	features featuremgmt.FeatureToggles,
	legacySecretsSvc grafanasecrets.Service,
	secretsSvc *service.SecureValueService,
	decryptSvc service.DecryptService,
) RepositorySecrets {
	return NewRepositorySecrets(features, NewSecretsService(secretsSvc, decryptSvc), NewSingleTenant(legacySecretsSvc))
}

//go:generate mockery --name RepositorySecrets --structname MockRepositorySecrets --inpackage --filename repository_secrets_mock.go --with-expecter
type RepositorySecrets interface {
	Encrypt(ctx context.Context, r *provisioning.Repository, name string, data string) (nameOrValue []byte, err error)
	Decrypt(ctx context.Context, r *provisioning.Repository, nameOrValue string) (data []byte, err error)
	Delete(ctx context.Context, r *provisioning.Repository, nameOrValue string) error
}

// repositorySecrets provides a unified interface for encrypting and decrypting repository secrets,
// supporting both the legacy and new secrets services. The active backend is determined by the
// FlagProvisioningSecretsService feature flag:
//   - If enabled, operations use the new secrets service.
//   - If disabled, operations use the legacy secrets service.
//
// This abstraction enables a seamless migration path between secret backends without breaking
// existing functionality. Once migration is complete and the legacy service is deprecated,
// this wrapper should be removed.
type repositorySecrets struct {
	features      featuremgmt.FeatureToggles
	secretsSvc    Service
	legacySecrets LegacyService
}

func NewRepositorySecrets(features featuremgmt.FeatureToggles, secretsSvc Service, legacySecrets LegacyService) RepositorySecrets {
	return &repositorySecrets{
		features:      features,
		secretsSvc:    secretsSvc,
		legacySecrets: legacySecrets,
	}
}

// Encrypt encrypts the data and returns the name or value of the encrypted data
// If the feature flag is disabled, it uses the legacy secrets service
// If the feature flag is enabled, it uses the secrets service
func (s *repositorySecrets) Encrypt(ctx context.Context, r *provisioning.Repository, name string, data string) (nameOrValue []byte, err error) {
	if s.features.IsEnabled(ctx, featuremgmt.FlagProvisioningSecretsService) {
		encrypted, err := s.secretsSvc.Encrypt(ctx, r.GetNamespace(), name, data)
		if err != nil {
			return nil, err
		}
		return []byte(encrypted), err
	}

	encrypted, err := s.legacySecrets.Encrypt(ctx, []byte(data))
	if err != nil {
		return nil, err
	}

	return encrypted, nil
}

// Decrypt attempts to retrieve and decrypt secret data for a repository.
// If the provisioning secrets service feature flag is enabled, it tries the new secrets service first.
//   - On success, returns the decrypted data.
//   - On failure, falls back to the legacy secrets service.
//
// If the feature flag is disabled, it tries the legacy secrets service first.
//   - On success, returns the decrypted data.
//   - On failure, falls back to the new secrets service.
//
// This dual-path logic is intended to support migration between secret backends.
func (s *repositorySecrets) Decrypt(ctx context.Context, r *provisioning.Repository, nameOrValue string) ([]byte, error) {
	if s.features.IsEnabled(ctx, featuremgmt.FlagProvisioningSecretsService) {
		data, err := s.secretsSvc.Decrypt(ctx, r.GetNamespace(), nameOrValue)
		if err == nil && len(data) > 0 {
			return data, nil
		}

		// If the new service fails or returns empty bytes, fall back to legacy
		fallbackData, fallbackErr := s.legacySecrets.Decrypt(ctx, []byte(nameOrValue))
		if fallbackErr != nil || len(fallbackData) == 0 {
			// Return original error if fallback fails or returns empty bytes
			if err != nil {
				return nil, err
			}
			return nil, errors.New("decryption returned empty data")
		}
		return fallbackData, nil
	}

	// If the new service is disabled, use the legacy service first
	data, err := s.legacySecrets.Decrypt(ctx, []byte(nameOrValue))
	if err == nil && len(data) > 0 {
		return data, nil
	}

	// If legacy service fails or returns empty bytes, fall back to new service
	fallbackData, fallbackErr := s.secretsSvc.Decrypt(ctx, r.GetNamespace(), nameOrValue)
	if fallbackErr != nil || len(fallbackData) == 0 {
		// Return original error if fallback fails or returns empty bytes
		if err != nil {
			return nil, err
		}
		return nil, errors.New("decryption returned empty data")
	}
	return fallbackData, nil
}

func (s *repositorySecrets) Delete(ctx context.Context, r *provisioning.Repository, nameOrValue string) error {
	if s.features.IsEnabled(ctx, featuremgmt.FlagProvisioningSecretsService) {
		err := s.secretsSvc.Delete(ctx, r.GetNamespace(), nameOrValue)
		if err != nil && !errors.Is(err, contracts.ErrSecureValueNotFound) {
			return err
		}
	}

	return nil
}

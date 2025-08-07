package secrets

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	legacysecrets "github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideRepositorySecrets(
	features featuremgmt.FeatureToggles,
	legacySecretsSvc legacysecrets.Service,
	secretsSvc contracts.SecureValueClient,
	decryptSvc secret.DecryptService,
	cfg *setting.Cfg,
) RepositorySecrets {
	return NewRepositorySecrets(features, NewSecretsService(secretsSvc, decryptSvc, cfg), NewSingleTenant(legacySecretsSvc))
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
	logger := logging.FromContext(ctx).With("name", name, "namespace", r.GetNamespace())
	if s.features.IsEnabled(ctx, featuremgmt.FlagProvisioningSecretsService) {
		logger.Info("Encrypting secret with new secrets service")
		encrypted, err := s.secretsSvc.Encrypt(ctx, r.GetNamespace(), name, data)
		if err != nil {
			return nil, err
		}
		return []byte(encrypted), err
	}

	logger.Info("Encrypting secret with legacy secrets service")
	encrypted, err := s.legacySecrets.Encrypt(ctx, []byte(data))
	if err != nil {
		return nil, err
	}

	return encrypted, nil
}

// Decrypt retrieves and decrypts secret data for a repository, supporting migration between secret backends.
// The backend used for decryption is determined by a heuristic:
//   - If the provided nameOrValue starts with the repository name, it is assumed to be a Kubernetes secret name
//     and the new secrets service is used for decryption.
//   - Otherwise, it is treated as a legacy secret value and the legacy secrets service is used.
//
// HACK: This approach relies on checking the prefix of nameOrValue to distinguish between secret backends.
// This is a temporary workaround to support both backends during migration and should be removed once
// migration is complete.
//
// This method ensures compatibility and minimizes disruption during the transition between secret backends.
func (s *repositorySecrets) Decrypt(ctx context.Context, r *provisioning.Repository, nameOrValue string) ([]byte, error) {
	logger := logging.FromContext(ctx)
	// HACK: this is a hack to identify if the name is a potential Kubernetes name for a secret.
	if strings.HasPrefix(nameOrValue, r.GetName()) {
		logger.Info("Decrypting secret with new secrets service")
		return s.secretsSvc.Decrypt(ctx, r.GetNamespace(), nameOrValue)
	} else {
		logger.Info("Decrypting secret with legacy secrets service")
		return s.legacySecrets.Decrypt(ctx, []byte(nameOrValue))
	}
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

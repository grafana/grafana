package manager

import (
	"cmp"
	"context"
	"fmt"

	secret "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/secret/keeper"
	"github.com/grafana/grafana/pkg/storage/secret/metastorage"
)

// This is the entrypoint for a securevalue.
// Here it gets encrypted and decrypted.
// Here it gets stored and retrieved.
// Many strategies available, local and remote for each.
type SecretsManagerService struct {
	metadataStore metastorage.SecretMetadataStore
	localKeeper   keeper.SecretKeeperService
	remoteKeepers map[keeper.SecretKeeperRemoteProvider]keeper.SecretKeeperService
}

// TODO: initialization of this thing.
func NewSecretsManagerService(
	metadataStore metastorage.SecretMetadataStore,
	localKeeper keeper.SecretKeeperService,
	remoteKeepers map[keeper.SecretKeeperRemoteProvider]keeper.SecretKeeperService,
) (*SecretsManagerService, error) {
	return &SecretsManagerService{metadataStore, localKeeper, remoteKeepers}, nil
}

// Create will encrypt a plaintext value and store it in a vault storage.
// TODO: what to return apart from the error?
func (s *SecretsManagerService) Create(ctx context.Context, securevalue *secret.SecureValue) (any, error) {
	// 1. Just a value is provided, use the local keeper to encrypt and store in SQL.
	if securevalue.Spec.Value != "" && securevalue.Spec.Manager == "" {
		ciphertext, err := s.localKeeper.Encryption().Encrypt(ctx, []byte(securevalue.Spec.Value))
		if err != nil {
			return nil, fmt.Errorf("could not encrypt: %w", err)
		}

		if err := s.localKeeper.VaultStorage().Store(ctx, ciphertext); err != nil {
			return nil, fmt.Errorf("could not store: %w", err)
		}
	}

	// 2. A `value` and a `key`, use remote keeper to encrypt and store in SQL.
	if securevalue.Spec.Value != "" && securevalue.Spec.Manager != "" {
		provider, _ := keeper.NewRemoteProvider(securevalue.Spec.Manager)

		remoteKeeper, ok := s.remoteKeepers[provider]
		if !ok {
			return nil, fmt.Errorf("could not find provider %v", provider)
		}

		ciphertext, err := remoteKeeper.Encryption().Encrypt(ctx, []byte(securevalue.Spec.Value))
		if err != nil {
			return nil, fmt.Errorf("could not remotely encrypt: %w", err)
		}

		if err := s.localKeeper.VaultStorage().Store(ctx, ciphertext); err != nil {
			return nil, fmt.Errorf("could not locally store: %w", err)
		}
	}

	// 3. Otherwise delegate everything to the remote keeper.
	// Path is not really what we want, maybe `securevalue.Spec.Store`, but we don't have it in the spec currently.
	if securevalue.Spec.Value == "" && securevalue.Spec.Manager != "" && securevalue.Spec.Path != "" {
		provider, _ := keeper.NewRemoteProvider(securevalue.Spec.Manager)

		remoteKeeper, ok := s.remoteKeepers[provider]
		if !ok {
			return nil, fmt.Errorf("could not find provider %v", provider)
		}

		ciphertext, err := remoteKeeper.Encryption().Encrypt(ctx, []byte(securevalue.Spec.Value))
		if err != nil {
			return nil, fmt.Errorf("could not encrypt: %w", err)
		}

		if err := remoteKeeper.VaultStorage().Store(ctx, ciphertext); err != nil {
			return nil, fmt.Errorf("could not store: %w", err)
		}
	}

	// 4. Just referencing a secret externally, not creating it.
	// TODO: here we bypass the keeper, and just store metadata.

	// also update the meta storage
	encryptionProvider := cmp.Or(securevalue.Spec.Manager, "local")
	vaultStorageProvider := cmp.Or(securevalue.Spec.Manager, "local")

	_ = s.metadataStore.Store(ctx, metastorage.SecureValueMetadata{
		UID:                  string(securevalue.UID),
		Name:                 securevalue.Name,
		Namespace:            securevalue.Namespace,
		EncryptionProvider:   encryptionProvider,   // where we encrypted it?
		VaultStorageProvider: vaultStorageProvider, // where we stored the secret?
	})

	// where was this encrypted?
	// where was this secret stored?
	// remote id to map back to our domain?

	return "", fmt.Errorf("todo")
}

// Decrypt will fetch from vault storage and decrypt the ciphertext.
func (s *SecretsManagerService) Decrypt(ctx context.Context, securevalue *secret.SecureValue) (string, error) {
	// How to know from where to fetch it from?
	meta, err := s.metadataStore.Retrieve(ctx, securevalue.Name, securevalue.Namespace)
	if err != nil {
		return "", fmt.Errorf("could not fetch secret metadata: %w", err)
	}

	var ciphertext string

	// First we retrieve the encrypted secret.
	if meta.EncryptionProvider == "" { // Locally stored (SQL DB).
		ciphertext, _ = s.localKeeper.VaultStorage().Retrieve(ctx, "some-id")
	} else { // Remotely stored (HashiVault, AWSSecretsManager).
		keeper := s.remoteKeepers[keeper.SecretKeeperRemoteProvider(meta.EncryptionProvider)]
		ciphertext, _ = keeper.VaultStorage().Retrieve(ctx, "some-id")
	}

	var plaintext []byte

	// Second we decrypt the secret.
	if meta.VaultStorageProvider == "" { // Local keeper did the encryption.
		plaintext, _ = s.localKeeper.Encryption().Decrypt(ctx, []byte(ciphertext))
	} else { // Remote keeper did the encryption.
		keeper := s.remoteKeepers[keeper.SecretKeeperRemoteProvider(meta.VaultStorageProvider)]
		plaintext, _ = keeper.Encryption().Decrypt(ctx, []byte(ciphertext))
	}

	// TODO: we might want a proper CRD here.
	return string(plaintext), nil
}

// Update a securevalue metadata and potentially its raw value.
func (s *SecretsManagerService) Update(ctx context.Context, securevalue *secret.SecureValue) (any, error) {
	// TODO: do we want to always override? do we want to decrypt the secret here and compare? maybe not a good idea.
	return s.Create(ctx, securevalue)
}

// Delete the securevalue from vault storage and metadata storage.
func (s *SecretsManagerService) Delete(ctx context.Context, ns string, name string) error {
	// 1. Delete from vault storage. (should we??? what about secrets that are created by someone else and we just read it?)
	// 2. Delete from metadata storage.
	return nil
}

// Reads the securevalue but does not decrypt it. Essentially only returns metadata.
func (s *SecretsManagerService) Read(ctx context.Context, ns string, name string) (*secret.SecureValue, error) {
	// Completely offload to metadata storage
	meta, err := s.metadataStore.Retrieve(ctx, name, ns)
	if err != nil {
		return nil, fmt.Errorf("could not retrieve securevalue meta")
	}
	_ = meta

	return &secret.SecureValue{}, nil
}

// List of securevalues but does not decrypt them. Essentially only returns metadata.
func (s *SecretsManagerService) List() (*secret.SecureValueList, error) {
	// TODO: call metadata store for this
	return new(secret.SecureValueList), nil
}

// History audit-log-like of changes to the securevalue (who when what)
func (s *SecretsManagerService) History() (*secret.SecureValueActivityList, error) {
	// TODO: call metadata store for this
	return new(secret.SecureValueActivityList), nil
}

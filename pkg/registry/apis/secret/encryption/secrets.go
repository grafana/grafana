package encryption

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

const UsageInsightsPrefix = "secrets_manager"

type ProviderConfig struct {
	CurrentProvider    ProviderID
	AvailableProviders ProviderMap
}

type ProviderMap map[ProviderID]Provider

// Provider is a fully configured key encryption key provider used for to encrypt and decrypt data keys for envelope encryption
type Provider interface {
	Encrypt(ctx context.Context, blob []byte) ([]byte, error)
	Decrypt(ctx context.Context, blob []byte) ([]byte, error)
}

type ProviderID string

// Kind returns the kind of the provider, e.g. "secret_key", "aws_kms", "azure_keyvault", "google_kms", "hashicorp_vault"
func (id ProviderID) Kind() (string, error) {
	idStr := string(id)

	parts := strings.SplitN(idStr, ".", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("malformatted provider identifier %s: expected format <provider>.<keyName>", idStr)
	}

	return parts[0], nil
}

// KeyLabel returns a label for the data key that is unique to the current provider and today's date.
func KeyLabel(providerID ProviderID) string {
	return fmt.Sprintf("%s@%s", time.Now().Format("2006-01-02"), providerID)
}

var ErrDataKeyCacheUnexpectedNamespace = errors.New("broken invariant: unexpected namespace in data key cache entry")

func ValidateDataKeyCacheEntryNamespace(methodNamespace string, entry DataKeyCacheEntry) error {
	if entry.Namespace == "" || entry.Namespace != methodNamespace {
		return ErrDataKeyCacheUnexpectedNamespace
	}
	return nil
}

// DataKeyCache is a multi-tenant cache used by the EncryptionManager to avoid expensive database lookups during repeated secret decryption operations.
// Data keys stored in the cache must be encrypted at-rest.
// Implementers are responsible for ensuring that the namespace of the entry is validated during setting and retrieval.
type DataKeyCache interface {
	// The implementation of Set must ensure the key is retrievable by both key and label
	Set(ctx context.Context, namespace string, entry DataKeyCacheEntry) error

	GetById(ctx context.Context, namespace, id string) (DataKeyCacheEntry, bool, error)
	GetByLabel(ctx context.Context, namespace, label string) (DataKeyCacheEntry, bool, error)

	RemoveExpired(ctx context.Context)
	Flush(ctx context.Context, namespace string)
}

type DataKeyCacheEntry struct {
	Namespace        string
	Id               string
	Label            string
	EncryptedDataKey []byte
	Active           bool
	Expiration       time.Time
}

func (e DataKeyCacheEntry) IsExpired() bool {
	return e.Expiration.Before(time.Now())
}

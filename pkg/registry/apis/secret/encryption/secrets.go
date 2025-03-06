package encryption

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Service is an envelope encryption service in charge of encrypting/decrypting secrets.
type Service interface {
	// Encrypt MUST NOT be used within database transactions, it may cause database locks.
	// For those specific use cases where the encryption operation cannot be moved outside
	// the database transaction, look at database-specific methods present at the specific
	// implementation present at manager.EncryptionService.
	Encrypt(ctx context.Context, namespace string, payload []byte, opt EncryptionOptions) ([]byte, error)
	Decrypt(ctx context.Context, namespace string, payload []byte) ([]byte, error)

	RotateDataKeys(ctx context.Context, namespace string) error
	ReEncryptDataKeys(ctx context.Context, namespace string) error
}

// Provider is a key encryption key provider for envelope encryption
type Provider interface {
	Encrypt(ctx context.Context, blob []byte) ([]byte, error)
	Decrypt(ctx context.Context, blob []byte) ([]byte, error)
}

type ProviderID string

func (id ProviderID) Kind() (string, error) {
	idStr := string(id)

	parts := strings.SplitN(idStr, ".", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("malformatted provider identifier %s: expected format <provider>.<keyName>", idStr)
	}

	return parts[0], nil
}

func KeyLabel(scope string, providerID ProviderID) string {
	return fmt.Sprintf("%s/%s@%s", time.Now().Format("2006-01-02"), scope, providerID)
}

// BackgroundProvider should be implemented for a provider that has a task that needs to be run in the background.
type BackgroundProvider interface {
	Run(ctx context.Context) error
}

// Migrator is responsible for secrets migrations like re-encrypting or rolling back secrets.
type Migrator interface {
	// ReEncryptSecrets decrypts and re-encrypts the secrets with most recent
	// available data key. If a secret-specific decryption / re-encryption fails,
	// it does not stop, but returns false as the first return (success or not)
	// at the end of the process.
	ReEncryptSecrets(ctx context.Context) (bool, error)
	// RollBackSecrets decrypts and re-encrypts the secrets using the legacy
	// encryption. If a secret-specific decryption / re-encryption fails, it
	// does not stop, but returns false as the first return (success or not)
	// at the end of the process.
	RollBackSecrets(ctx context.Context) (bool, error)
}

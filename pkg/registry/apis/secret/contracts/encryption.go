package contracts

import "context"

// EncryptionManager is an envelope encryption service in charge of encrypting/decrypting secrets.
type EncryptionManager interface {
	// Encrypt MUST NOT be used within database transactions, it may cause database locks.
	// For those specific use cases where the encryption operation cannot be moved outside
	// the database transaction, look at database-specific methods present at the specific
	// implementation present at manager.EncryptionService.
	Encrypt(ctx context.Context, namespace string, payload []byte, opt EncryptionOptions) ([]byte, error)
	Decrypt(ctx context.Context, namespace string, payload []byte) ([]byte, error)

	RotateDataKeys(ctx context.Context, namespace string) error
	ReEncryptDataKeys(ctx context.Context, namespace string) error
}

type EncryptionOptions func() string

// EncryptWithoutScope uses a root level data key for encryption (DEK),
// in other words this DEK is not bound to any specific scope (not attached to any user, org, etc.).
func EncryptWithoutScope() EncryptionOptions {
	return func() string {
		return "root"
	}
}

// EncryptWithScope uses a data key for encryption bound to some specific scope (i.e., user, org, etc.).
// Scope should look like "user:10", "org:1".
func EncryptWithScope(scope string) EncryptionOptions {
	return func() string {
		return scope
	}
}

type EncryptedValue struct {
	UID           string
	Namespace     string
	EncryptedData []byte
	Created       int64
	Updated       int64
}

type EncryptedValueStorage interface {
	Create(ctx context.Context, namespace string, encryptedData []byte) (*EncryptedValue, error)
	Update(ctx context.Context, namespace string, uid string, encryptedData []byte) error
	Get(ctx context.Context, namespace string, uid string) (*EncryptedValue, error)
	Delete(ctx context.Context, namespace string, uid string) error
}

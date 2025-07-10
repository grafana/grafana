package contracts

import "context"

// EncryptionManager is an envelope encryption service in charge of encrypting/decrypting secrets.
type EncryptionManager interface {
	// Encrypt MUST NOT be used within database transactions, it may cause database locks.
	// For those specific use cases where the encryption operation cannot be moved outside
	// the database transaction, look at database-specific methods present at the specific
	// implementation present at manager.EncryptionService.
	Encrypt(ctx context.Context, namespace string, payload []byte) ([]byte, error)
	Decrypt(ctx context.Context, namespace string, payload []byte) ([]byte, error)
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

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
	Namespace     string
	Name          string
	Version       int64
	EncryptedData []byte
	Created       int64
	Updated       int64
}

// ListOpts defines pagination options for listing encrypted values.
type ListOpts struct {
	Limit  int64
	Offset int64
}

type EncryptedValueStorage interface {
	Create(ctx context.Context, namespace, name string, version int64, encryptedData []byte) (*EncryptedValue, error)
	Update(ctx context.Context, namespace, name string, version int64, encryptedData []byte) error
	Get(ctx context.Context, namespace, name string, version int64) (*EncryptedValue, error)
	Delete(ctx context.Context, namespace, name string, version int64) error
}

type GlobalEncryptedValueStorage interface {
	ListAll(ctx context.Context, opts ListOpts, untilTime *int64) ([]*EncryptedValue, error)
	CountAll(ctx context.Context, untilTime *int64) (int64, error)
}

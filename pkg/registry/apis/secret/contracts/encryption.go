package contracts

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// EncryptionManager is an envelope encryption service in charge of encrypting/decrypting secrets.
type EncryptionManager interface {
	// Encrypt MUST NOT be used within database transactions, it may cause database locks.
	// For those specific use cases where the encryption operation cannot be moved outside
	// the database transaction, look at database-specific methods present at the specific
	// implementation present at manager.EncryptionService.
	Encrypt(ctx context.Context, namespace xkube.Namespace, payload []byte) (EncryptedPayload, error)
	Decrypt(ctx context.Context, namespace xkube.Namespace, payload EncryptedPayload) ([]byte, error)
}

type EncryptedPayload struct {
	DataKeyID     string
	EncryptedData []byte
}

type EncryptedValue struct {
	EncryptedPayload

	Namespace string
	Name      string
	Version   int64
	Created   int64
	Updated   int64
}

// ListOpts defines pagination options for listing encrypted values.
type ListOpts struct {
	Limit  int64
	Offset int64
}

type EncryptedValueStorage interface {
	Create(ctx context.Context, namespace xkube.Namespace, name string, version int64, encryptedData EncryptedPayload) (*EncryptedValue, error)
	Update(ctx context.Context, namespace xkube.Namespace, name string, version int64, encryptedData EncryptedPayload) error
	Get(ctx context.Context, namespace xkube.Namespace, name string, version int64) (*EncryptedValue, error)
	Delete(ctx context.Context, namespace xkube.Namespace, name string, version int64) error
}

type GlobalEncryptedValueStorage interface {
	ListAll(ctx context.Context, opts ListOpts, untilTime *int64) ([]*EncryptedValue, error)
	CountAll(ctx context.Context, untilTime *int64) (int64, error)
}

type EncryptedValueMigrationExecutor interface {
	Execute(ctx context.Context) (int, error)
}

type ConsolidationService interface {
	Consolidate(ctx context.Context) error
}

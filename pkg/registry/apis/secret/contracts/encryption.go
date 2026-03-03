package contracts

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type EncryptionOption struct {
	// When calling Encrypt within a database transaction, you must set SkipCache to true.
	SkipCache bool
}

// EncryptionManager is an envelope encryption service in charge of encrypting/decrypting secrets.
type EncryptionManager interface {
	Encrypt(ctx context.Context, namespace xkube.Namespace, payload []byte, opts EncryptionOption) (EncryptedPayload, error)
	Decrypt(ctx context.Context, namespace xkube.Namespace, payload EncryptedPayload, opts EncryptionOption) ([]byte, error)

	// ConsolidateNamespace efficiently re-encrypts all given values for a single namespace using a new DEK, ensuring old DEKs are removed from the cache afterwards.
	// Returns one payload per value in the same order; nil entries indicate decrypt or re-encrypt failure for that value.
	ConsolidateNamespace(ctx context.Context, namespace xkube.Namespace, values []*EncryptedValue) ([]*EncryptedPayload, error)
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
	Limit          int64
	Offset         int64
	OrderBy        string
	OrderDirection OrderDirection
}

type OrderDirection string

const (
	OrderDirectionAsc  OrderDirection = "ASC"
	OrderDirectionDesc OrderDirection = "DESC"
)

// BulkUpdateRow is one row for UpdateBulk: identity (Name, Version) and new payload.
type BulkUpdateRow struct {
	Name    string
	Version int64
	Payload EncryptedPayload
}

type EncryptedValueStorage interface {
	Create(ctx context.Context, namespace xkube.Namespace, name string, version int64, encryptedData EncryptedPayload) (*EncryptedValue, error)
	Update(ctx context.Context, namespace xkube.Namespace, name string, version int64, encryptedData EncryptedPayload) error
	UpdateBulk(ctx context.Context, namespace xkube.Namespace, updates []BulkUpdateRow, chunkSize int) error
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

// ConsolidateOptions configures consolidation when called from the CLI.
type ConsolidateOptions struct {
	ChunkSize int // max number of encrypted values per bulk update; default 100
	Workers   int // number of parallel namespaces to consolidate; default 1
}

type ConsolidationService interface {
	// Consolidate deactivates all old data keys, then re-encrypts all secure values with a new one
	Consolidate(ctx context.Context, opts *ConsolidateOptions) error
}

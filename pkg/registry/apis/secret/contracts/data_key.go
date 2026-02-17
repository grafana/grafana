package contracts

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
)

var (
	ErrDataKeyNotFound         = errors.New("data key not found")
	ErrNoConsolidationToFinish = errors.New("no consolidation to finish")
)

// SecretDataKey does not have a mirrored K8s resource
type SecretDataKey struct {
	UID           string
	Active        bool
	Namespace     string
	Label         string
	Provider      encryption.ProviderID
	EncryptedData []byte
	Created       time.Time
	Updated       time.Time
}

// DataKeyStorage is the interface for wiring and dependency injection.
type DataKeyStorage interface {
	CreateDataKey(ctx context.Context, dataKey *SecretDataKey) error
	GetDataKey(ctx context.Context, namespace, uid string) (*SecretDataKey, error)
	GetCurrentDataKey(ctx context.Context, namespace, label string) (*SecretDataKey, error)
	ListDataKeys(ctx context.Context, namespace string) ([]*SecretDataKey, error)
	DisableDataKeys(ctx context.Context, namespace string) error
	DeleteDataKey(ctx context.Context, namespace, uid string) error
}

// GlobalDataKeyStorage is an interface for namespace unbounded operations.
type GlobalDataKeyStorage interface {
	DisableAllDataKeys(ctx context.Context) error
}

// ConsolidationRecord is for internal use only and does not have a mirrored K8s resource
type ConsolidationRecord struct {
	ID        int64
	Created   time.Time
	Completed time.Time
}

// ConsolidationHistoryStorage is the interface for wiring and dependency injection.
type ConsolidationHistoryStorage interface {
	StartNewConsolidation(ctx context.Context) error
	FinishCurrentConsolidation(ctx context.Context) error
	GetLatestConsolidation(ctx context.Context) (*ConsolidationRecord, error)
}

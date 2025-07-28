package contracts

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
)

var (
	ErrDataKeyNotFound = errors.New("data key not found")
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

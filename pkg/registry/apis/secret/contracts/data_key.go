package contracts

import (
	"context"
	"errors"
	"time"
)

type EncryptionProvider string

const (
	ProviderSecretKey      EncryptionProvider = "secret_key"
	ProviderAWSKMS         EncryptionProvider = "aws_kms"
	ProviderAzureKV        EncryptionProvider = "azure_kv"
	ProviderGoogleKMS      EncryptionProvider = "google_kms"
	ProviderHashicorpVault EncryptionProvider = "hashicorp_vault"
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
	Provider      EncryptionProvider
	EncryptedData []byte
	Created       time.Time
	Updated       time.Time
}

// DataKeyStorage is the interface for wiring and dependency injection.
type DataKeyStorage interface {
	CreateDataKey(ctx context.Context, dataKey *SecretDataKey) error
	GetDataKey(ctx context.Context, namespace, uid string) (*SecretDataKey, error)
	GetCurrentDataKey(ctx context.Context, namespace, label string) (*SecretDataKey, error)
	GetAllDataKeys(ctx context.Context, namespace string) ([]*SecretDataKey, error)
	DisableDataKeys(ctx context.Context, namespace string) error
	DeleteDataKey(ctx context.Context, namespace, uid string) error
}

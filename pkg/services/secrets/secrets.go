package secrets

import (
	"context"

	"xorm.io/xorm"
)

// Service is an envelope encryption service in charge of encrypting/decrypting secrets.
// It is a replacement for encryption.Service
type Service interface {
	Encrypt(ctx context.Context, payload []byte, opt EncryptionOptions) ([]byte, error)
	Decrypt(ctx context.Context, payload []byte) ([]byte, error)
	EncryptJsonData(ctx context.Context, kv map[string]string, opt EncryptionOptions) (map[string][]byte, error)
	DecryptJsonData(ctx context.Context, sjd map[string][]byte) (map[string]string, error)
	GetDecryptedValue(ctx context.Context, sjd map[string][]byte, key, fallback string) string
}

type ProvidersRegistrar interface {
	CurrentProviderID() string
	GetProviders() map[string]Provider
	RegisterProvider(providerID string, provider Provider)
}

// Store defines methods to interact with secrets storage
type Store interface {
	GetDataKey(ctx context.Context, name string) (*DataKey, error)
	GetAllDataKeys(ctx context.Context) ([]*DataKey, error)
	CreateDataKey(ctx context.Context, dataKey DataKey) error
	CreateDataKeyWithDBSession(ctx context.Context, dataKey DataKey, sess *xorm.Session) error
	DeleteDataKey(ctx context.Context, name string) error
}

// Provider is a key encryption key provider for envelope encryption
type Provider interface {
	Encrypt(ctx context.Context, blob []byte) ([]byte, error)
	Decrypt(ctx context.Context, blob []byte) ([]byte, error)
}

package encryption

import "context"

// Internal must not be used for general purpose encryption.
// This service is used as an internal component for envelope encryption
// and for very specific few use cases that still require legacy encryption.
//
// Unless there is any specific reason, you must use secrets.Service instead.
type Internal interface {
	Encrypt(ctx context.Context, payload []byte, secret string) ([]byte, error)
	Decrypt(ctx context.Context, payload []byte, secret string) ([]byte, error)

	EncryptJsonData(ctx context.Context, kv map[string]string, secret string) (map[string][]byte, error)
	DecryptJsonData(ctx context.Context, sjd map[string][]byte, secret string) (map[string]string, error)

	GetDecryptedValue(ctx context.Context, sjd map[string][]byte, key string, fallback string, secret string) string
}

package encryption

import "context"

type Service interface {
	Encrypt(ctx context.Context, payload []byte, secret string) ([]byte, error)
	Decrypt(ctx context.Context, payload []byte, secret string) ([]byte, error)

	EncryptJsonData(ctx context.Context, kv map[string]string, secret string) (map[string][]byte, error)
	DecryptJsonData(ctx context.Context, sjd map[string][]byte, secret string) (map[string]string, error)

	GetDecryptedValue(ctx context.Context, sjd map[string][]byte, key string, fallback string, secret string) string
}

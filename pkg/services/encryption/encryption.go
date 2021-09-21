package encryption

import "context"

type Service interface {
	Encrypt(context.Context, []byte, string) ([]byte, error)
	Decrypt(context.Context, []byte, string) ([]byte, error)

	EncryptJsonData(context.Context, map[string]string, string) (map[string][]byte, error)
	DecryptJsonData(context.Context, map[string][]byte, string) (map[string]string, error)

	GetDecryptedValue(context.Context, map[string][]byte, string, string, string) string
}

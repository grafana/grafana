package encryption

import (
	"context"
	"crypto/pbkdf2"
	"crypto/sha256"
)

const (
	SaltLength = 8

	AesCfb = "aes-cfb"
	AesGcm = "aes-gcm"
)

// Internal must not be used for general purpose encryption.
// This service is used as an internal component for envelope encryption
// and for very specific few use cases that still require legacy encryption.
//
// Unless there is any specific reason, you must use secrets.Service instead.
type Internal interface {
	Cipher
	Decipher

	EncryptJsonData(ctx context.Context, kv map[string]string, secret string) (map[string][]byte, error)
	DecryptJsonData(ctx context.Context, sjd map[string][]byte, secret string) (map[string]string, error)

	GetDecryptedValue(ctx context.Context, sjd map[string][]byte, key string, fallback string, secret string) string
}

type Cipher interface {
	Encrypt(ctx context.Context, payload []byte, secret string) ([]byte, error)
}

type Decipher interface {
	Decrypt(ctx context.Context, payload []byte, secret string) ([]byte, error)
}

type Provider interface {
	ProvideCiphers() map[string]Cipher
	ProvideDeciphers() map[string]Decipher
}

// KeyToBytes key length needs to be 32 bytes
func KeyToBytes(secret, salt string) ([]byte, error) {
	return pbkdf2.Key(sha256.New, secret, []byte(salt), 10000, 32)
}

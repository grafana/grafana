package cipher

import (
	"context"
	"crypto/sha256"

	"golang.org/x/crypto/pbkdf2"
)

const (
	SaltLength = 8

	AesCfb = "aes-cfb"
	AesGcm = "aes-gcm"
)

// Encryption must not be used for general purpose encryption.
// This service is used as an internal component for envelope encryption
// and for very specific few use cases that still require legacy encryption.
//
// Unless there is any specific reason, you must use secrets.Service instead.
type Encryption interface {
	Cipher
	Decipher
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
	return pbkdf2.Key([]byte(secret), []byte(salt), 10000, 32, sha256.New), nil
}

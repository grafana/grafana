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

type Cipher interface {
	Encrypter
	Decrypter
}

type Encrypter interface {
	Encrypt(ctx context.Context, payload []byte, secret string) ([]byte, error)
}

type Decrypter interface {
	Decrypt(ctx context.Context, payload []byte, secret string) ([]byte, error)
}

type Provider interface {
	ProvideCiphers() map[string]Encrypter
	ProvideDeciphers() map[string]Decrypter
}

// KeyToBytes key length needs to be 32 bytes
func KeyToBytes(secret, salt []byte) ([]byte, error) {
	return pbkdf2.Key([]byte(secret), []byte(salt), 10000, 32, sha256.New), nil
}

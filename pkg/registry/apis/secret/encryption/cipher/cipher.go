package cipher

import (
	"context"
)

const (
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

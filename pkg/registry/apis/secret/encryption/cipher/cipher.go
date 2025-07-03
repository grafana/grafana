package cipher

import (
	"context"
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

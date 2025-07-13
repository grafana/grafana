package secretkeyprovider

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

type SecretKeyProvider struct {
	sk         string
	encryption cipher.Cipher
}

func New(sk string, encryption cipher.Cipher) encryption.Provider {
	return SecretKeyProvider{
		sk:         sk,
		encryption: encryption,
	}
}

func (p SecretKeyProvider) Encrypt(ctx context.Context, blob []byte) ([]byte, error) {
	return p.encryption.Encrypt(ctx, blob, p.sk)
}

func (p SecretKeyProvider) Decrypt(ctx context.Context, blob []byte) ([]byte, error) {
	return p.encryption.Decrypt(ctx, blob, p.sk)
}

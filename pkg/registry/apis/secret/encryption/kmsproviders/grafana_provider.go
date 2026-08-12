package kmsproviders

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

type secretKeyProvider struct {
	sk         string
	encryption cipher.Cipher
}

func newSecretKeyProvider(sk string, encryption cipher.Cipher) encryption.Provider {
	return secretKeyProvider{
		sk:         sk,
		encryption: encryption,
	}
}

func (p secretKeyProvider) Encrypt(ctx context.Context, blob []byte) ([]byte, error) {
	return p.encryption.Encrypt(ctx, blob, p.sk)
}

func (p secretKeyProvider) Decrypt(ctx context.Context, blob []byte) ([]byte, error) {
	return p.encryption.Decrypt(ctx, blob, p.sk)
}

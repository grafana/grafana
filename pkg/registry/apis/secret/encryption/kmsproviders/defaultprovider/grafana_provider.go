package defaultprovider

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

type grafanaProvider struct {
	sk         string
	encryption cipher.Cipher
}

func New(sk string, encryption cipher.Cipher) encryption.Provider {
	return grafanaProvider{
		sk:         sk,
		encryption: encryption,
	}
}

func (p grafanaProvider) Encrypt(ctx context.Context, blob []byte) ([]byte, error) {
	return p.encryption.Encrypt(ctx, blob, p.sk)
}

func (p grafanaProvider) Decrypt(ctx context.Context, blob []byte) ([]byte, error) {
	return p.encryption.Decrypt(ctx, blob, p.sk)
}

package kmsproviders

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

var _ encryption.EncryptionProvider = &grafanaProvider{}

type grafanaProvider struct {
	sk         string
	encryption cipher.Cipher
}

func NewOSSKMSProvider(sk string, encryption cipher.Cipher) encryption.EncryptionProvider {
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

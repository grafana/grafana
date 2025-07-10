package kmsproviders

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
)

var _ encryption.EncryptionProvider = &unavailableEnterpriseKMSProvider{}

var ErrorEnterpriseKMSProviderNotAvailable = errors.New("enterprise KMS provider is not available in OSS")

// ProvideEnterpriseKMSProvider passes this noop service into the encryption manager via wire in OSS
// In Enterprise, the MT factory passes in the enterprise KMS provider
func ProvideEnterpriseKMSProvider() encryption.EncryptionProvider {
	return &unavailableEnterpriseKMSProvider{}
}

type unavailableEnterpriseKMSProvider struct {
}

// In OSS, there are no providers beyond Grafana envelope encryption
func (p *unavailableEnterpriseKMSProvider) Encrypt(ctx context.Context, blob []byte) ([]byte, error) {
	return nil, ErrorEnterpriseKMSProviderNotAvailable
}

func (p *unavailableEnterpriseKMSProvider) Decrypt(ctx context.Context, blob []byte) ([]byte, error) {
	return nil, ErrorEnterpriseKMSProviderNotAvailable
}

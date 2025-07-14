package kmsproviders

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// OSSProviderType is the identifier of the default kms provider which fallbacks to the configured secret_key
	OSSProviderType = "secret_key"
	// SecretKeyKey is the key in the section that contains the secret key
	SecretKeyKey = "secret_key"
)

// ProvideOSSKMSProviders provides the ProviderConfig expected by the encryption manager in the OSS wire configuration.
// It looks for all configured 'secret_key' sections and creates a separate provider for each, each with its own secret key, allowing users to upgrade their secret key without breaking existing secrets.
func ProvideOSSKMSProviders(cfg *setting.Cfg, cipher cipher.Cipher) (encryption.ProviderConfig, error) {
	pCfg := encryption.ProviderConfig{
		CurrentProvider:    encryption.ProviderID(cfg.SecretsManagement.CurrentEncryptionProvider),
		AvailableProviders: make(encryption.ProviderMap),
	}

	// Look through the available secret_key providers and add them to the map
	for providerName, properties := range cfg.SecretsManagement.ConfiguredKMSProviders {
		if strings.HasPrefix(providerName, OSSProviderType) {
			secretKey := properties[SecretKeyKey]
			if secretKey != "" {
				pCfg.AvailableProviders[encryption.ProviderID(providerName)] = newSecretKeyProvider(secretKey, cipher)
			} else {
				return pCfg, fmt.Errorf("missing secret_key for provider %s", providerName)
			}
		}
	}

	return pCfg, nil
}

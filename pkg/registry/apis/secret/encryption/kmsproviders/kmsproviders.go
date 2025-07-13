package kmsproviders

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/kmsproviders/secretkeyprovider"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// OSSProviderType is the identifier of the default kms provider which fallbacks to the configured secret_key
	OSSProviderType = "secret_key"
	// SecretKeyKey is the key in the section that contains the secret key
	SecretKeyKey = "secret_key"
)

func ProvideOSSKMSProviders(cfg *setting.Cfg, cipher cipher.Cipher) (encryption.ProviderMap, error) {
	providerMap := make(encryption.ProviderMap)

	// Look through the available secret_key providers and add them to the map
	for providerName, properties := range cfg.SecretsManagement.ConfiguredKMSProviders {
		if strings.HasPrefix(providerName, OSSProviderType) {
			secretKey := properties[SecretKeyKey]
			if secretKey != "" {
				providerMap[encryption.ProviderID(providerName)] = secretkeyprovider.New(secretKey, cipher)
			} else {
				return nil, fmt.Errorf("missing secret_key for provider %s", providerName)
			}
		}
	}

	return providerMap, nil
}

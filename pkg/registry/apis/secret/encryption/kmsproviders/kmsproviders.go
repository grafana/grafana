package kmsproviders

import (
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/kmsproviders/defaultprovider"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// Default is the identifier of the default kms provider which fallbacks to the configured secret_key
	Default = "secretKey.v1"
)

func GetOSSKMSProviders(cfg *setting.Cfg, enc cipher.Cipher) encryption.ProviderMap {
	return encryption.ProviderMap{
		Default: defaultprovider.New(cfg.SecretsManagement.SecretKey, enc),
	}
}

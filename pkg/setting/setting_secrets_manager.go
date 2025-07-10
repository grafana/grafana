package setting

import "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"

type SecretsManagerSettings struct {
	SecretKey          string
	EncryptionProvider contracts.EncryptionProvider
}

func (cfg *Cfg) readSecretsManagerSettings() {
	secretsMgmt := cfg.Raw.Section("secrets_manager")
	cfg.SecretsManagement.EncryptionProvider = contracts.EncryptionProvider(secretsMgmt.Key("encryption_provider").MustString(string(contracts.ProviderSecretKey)))

	cfg.SecretsManagement.SecretKey = secretsMgmt.Key("secret_key").MustString("")
}

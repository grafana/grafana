package setting

import (
	"regexp"
	"time"

	"github.com/grafana/grafana/pkg/services/kmsproviders"
)

type EncryptionSettings struct {
	DataKeysCacheTTL        time.Duration
	DataKeysCleanupInterval time.Duration
}

type SecretsManagerSettings struct {
	SecretKey          string
	EncryptionProvider string
	AvailableProviders []string

	Encryption EncryptionSettings

	IsDeveloperMode      bool
	DeveloperStubLatency time.Duration
}

func (cfg *Cfg) readSecretsManagerSettings() {
	secretsMgmt := cfg.Raw.Section("secrets_manager")
	cfg.SecretsManagement.IsDeveloperMode = secretsMgmt.Key("dev_mode").MustBool(false)
	cfg.SecretsManagement.DeveloperStubLatency = secretsMgmt.Key("dev_stub_latency").MustDuration(0)
	cfg.SecretsManagement.EncryptionProvider = secretsMgmt.Key("encryption_provider").MustString(kmsproviders.Default)

	// TODO: These are not used yet by the secrets manager because we need to distentagle the dependencies with OSS.
	cfg.SecretsManagement.SecretKey = secretsMgmt.Key("secret_key").MustString("")
	// parse comma separated list
	r := regexp.MustCompile(`\s*,\s*`)
	cfg.SecretsManagement.AvailableProviders = r.Split(secretsMgmt.Key("available_encryption_providers").MustString(""), -1)

	encryption := cfg.Raw.Section("secrets_manager.encryption")
	cfg.SecretsManagement.Encryption.DataKeysCacheTTL = encryption.Key("data_keys_cache_ttl").MustDuration(15 * time.Minute)
	cfg.SecretsManagement.Encryption.DataKeysCleanupInterval = encryption.Key("data_keys_cache_cleanup_interval").MustDuration(1 * time.Minute)
}

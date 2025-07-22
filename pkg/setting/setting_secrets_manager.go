package setting

import (
	"strings"
)

const (
	ProviderPrefix        = "secrets_manager.encryption."
	MisconfiguredProvider = "misconfigured"
)

type SecretsManagerSettings struct {
	CurrentEncryptionProvider string

	// ConfiguredKMSProviders is a map of KMS providers found in the config file. The keys are in the format of <provider>.<keyName>, and the values are a map of the properties in that section
	// In OSS, the provider type can only be "secret_key". In Enterprise, it can additionally be one of: "aws_kms", "azure_keyvault", "google_kms", "hashicorp_vault"
	ConfiguredKMSProviders map[string]map[string]string

	DecryptServerType         string // "local" or "grpc"
	DecryptServerAddress      string // Address for external secrets server (used when storage_type = grpc)
	DecryptGrafanaServiceName string // Service name to use for background grafana decryption
}

func (cfg *Cfg) readSecretsManagerSettings() {
	secretsMgmt := cfg.Raw.Section("secrets_manager")
	cfg.SecretsManagement.CurrentEncryptionProvider = secretsMgmt.Key("encryption_provider").MustString(MisconfiguredProvider)

	cfg.SecretsManagement.DecryptServerType = valueAsString(secretsMgmt, "decrypt_server_type", "local")
	cfg.SecretsManagement.DecryptServerAddress = valueAsString(secretsMgmt, "decrypt_server_address", "")
	cfg.SecretsManagement.DecryptGrafanaServiceName = valueAsString(secretsMgmt, "decrypt_grafana_service_name", "")

	// Extract available KMS providers from configuration sections
	providers := make(map[string]map[string]string)
	for _, section := range cfg.Raw.Sections() {
		sectionName := section.Name()
		if strings.HasPrefix(sectionName, ProviderPrefix) {
			// Extract the provider name (everything after the prefix)
			providerName := strings.TrimPrefix(sectionName, ProviderPrefix)
			if providerName != "" {
				providers[providerName] = section.KeysHash()
			}
		}
	}
	cfg.SecretsManagement.ConfiguredKMSProviders = providers
}

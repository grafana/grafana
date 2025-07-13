package setting

import (
	"strings"
)

const (
	ProviderPrefix        = "secrets_manager.encryption."
	MisconfiguredProvider = "misconfigured"
)

type SecretsManagerSettings struct {
	EncryptionProvider string

	// ConfiguredKMSProviders is a map of KMS providers found in the config file. The keys are in the format of <provider>.<keyName>, and the values are a map of the properties in that section
	// In OSS, the provider type can only be "secret_key". In Enterprise, it will be one of: aws_kms, azure_keyvault, google_kms, hashicorp_vault
	ConfiguredKMSProviders map[string]map[string]string
}

func (cfg *Cfg) readSecretsManagerSettings() {
	secretsMgmt := cfg.Raw.Section("secrets_manager")
	cfg.SecretsManagement.EncryptionProvider = secretsMgmt.Key("encryption_provider").MustString(MisconfiguredProvider)

	// Extract available KMS providers from configuration sections
	availableProviders := make(map[string]map[string]string)
	for _, section := range cfg.Raw.Sections() {
		sectionName := section.Name()
		if strings.HasPrefix(sectionName, ProviderPrefix) {
			// Extract the provider name (everything after the prefix)
			providerName := strings.TrimPrefix(sectionName, ProviderPrefix)
			if providerName != "" {
				availableProviders[providerName] = section.KeysHash()
			}
		}
	}
	cfg.SecretsManagement.ConfiguredKMSProviders = availableProviders
}

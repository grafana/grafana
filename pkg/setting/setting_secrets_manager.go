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

	GrpcClientEnable        bool   // Whether to enable the gRPC client. If disabled, it will use the in-process services implementations.
	GrpcServerUseTLS        bool   // Whether to use TLS when communicating with the gRPC server
	GrpcServerTLSSkipVerify bool   // Whether to skip TLS verification when communicating with the gRPC server
	GrpcServerTLSServerName string // Server name to use for TLS verification
	GrpcServerAddress       string // Address for gRPC secrets server
	GrpcGrafanaServiceName  string // Service name to use for background grafana decryption/inline
}

func (cfg *Cfg) readSecretsManagerSettings() {
	secretsMgmt := cfg.Raw.Section("secrets_manager")
	cfg.SecretsManagement.CurrentEncryptionProvider = secretsMgmt.Key("encryption_provider").MustString(MisconfiguredProvider)

	cfg.SecretsManagement.GrpcClientEnable = secretsMgmt.Key("grpc_client_enable").MustBool(false)
	cfg.SecretsManagement.GrpcServerUseTLS = secretsMgmt.Key("grpc_server_use_tls").MustBool(false)
	cfg.SecretsManagement.GrpcServerTLSSkipVerify = secretsMgmt.Key("grpc_server_tls_skip_verify").MustBool(false)
	cfg.SecretsManagement.GrpcServerTLSServerName = valueAsString(secretsMgmt, "grpc_server_tls_server_name", "")
	cfg.SecretsManagement.GrpcServerAddress = valueAsString(secretsMgmt, "grpc_server_address", "")
	cfg.SecretsManagement.GrpcGrafanaServiceName = valueAsString(secretsMgmt, "grpc_grafana_service_name", "")

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

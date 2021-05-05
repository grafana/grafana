package setting

import "strings"

const (
	AzureCloud        = "AzureCloud"
	AzureChinaCloud   = "AzureChinaCloud"
	AzureUSGovernment = "AzureUSGovernment"
	AzureGermanCloud  = "AzureGermanCloud"
)

type AzureSettings struct {
	Cloud                     string
	ManagedIdentityEnabled    bool
	ManagedIdentityTokenUrl   string
	ManagedIdentityObjectId   string
	ManagedIdentityClientId   string
	ManagedIdentityResourceId string
}

func (cfg *Cfg) readAzureSettings() {
	azureSection := cfg.Raw.Section("azure")

	// Cloud
	cloudName := azureSection.Key("cloud").MustString(AzureCloud)
	cfg.Azure.Cloud = normalizeAzureCloud(cloudName)

	// Managed Identity
	cfg.Azure.ManagedIdentityEnabled = azureSection.Key("managed_identity_enabled").MustBool(false)
	cfg.Azure.ManagedIdentityTokenUrl = azureSection.Key("managed_identity_token_url").String()
	cfg.Azure.ManagedIdentityObjectId = azureSection.Key("managed_identity_object_id").String()
	cfg.Azure.ManagedIdentityClientId = azureSection.Key("managed_identity_client_id").String()
	cfg.Azure.ManagedIdentityResourceId = azureSection.Key("managed_identity_resource_id").String()
}

func normalizeAzureCloud(cloudName string) string {
	switch strings.ToLower(cloudName) {
	// Public
	case "azurecloud":
	case "azurepubliccloud":
	case "public":
		return AzureCloud

	// China
	case "azurechinacloud":
	case "china":
		return AzureChinaCloud

	// US Government
	case "azureusgovernment":
	case "azureusgovernmentcloud":
	case "usgovernment":
		return AzureUSGovernment

	// Germany
	case "azuregermancloud":
	case "german":
		return AzureGermanCloud
	}

	// Default to public cloud
	return AzureCloud
}

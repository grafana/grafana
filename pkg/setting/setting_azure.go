package setting

import "strings"

const (
	AzurePublic       = "AzureCloud"
	AzureChina        = "AzureChinaCloud"
	AzureUSGovernment = "AzureUSGovernment"
	AzureGermany      = "AzureGermanCloud"
)

type AzureSettings struct {
	Cloud                   string
	ManagedIdentityEnabled  bool
	ManagedIdentityClientId string
}

func (cfg *Cfg) readAzureSettings() {
	azureSection := cfg.Raw.Section("azure")

	// Cloud
	cloudName := azureSection.Key("cloud").MustString(AzurePublic)
	cfg.Azure.Cloud = normalizeAzureCloud(cloudName)

	// Managed Identity
	cfg.Azure.ManagedIdentityEnabled = azureSection.Key("managed_identity_enabled").MustBool(false)
	cfg.Azure.ManagedIdentityClientId = azureSection.Key("managed_identity_client_id").String()
}

func normalizeAzureCloud(cloudName string) string {
	switch strings.ToLower(cloudName) {
	// Public
	case "azurecloud":
	case "azurepublic":
	case "azurepubliccloud":
	case "public":
		return AzurePublic

	// China
	case "azurechina":
	case "azurechinacloud":
	case "china":
		return AzureChina

	// US Government
	case "azureusgovernment":
	case "azureusgovernmentcloud":
	case "usgov":
	case "usgovernment":
		return AzureUSGovernment

	// Germany
	case "azuregermancloud":
	case "azuregermany":
	case "german":
	case "germany":
		return AzureGermany
	}

	// Pass the name unchanged if it's not known
	return cloudName
}

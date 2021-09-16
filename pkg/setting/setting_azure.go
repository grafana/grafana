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
		fallthrough
	case "azurepublic":
		fallthrough
	case "azurepubliccloud":
		fallthrough
	case "public":
		return AzurePublic

	// China
	case "azurechina":
		fallthrough
	case "azurechinacloud":
		fallthrough
	case "china":
		return AzureChina

	// US Government
	case "azureusgovernment":
		fallthrough
	case "azureusgovernmentcloud":
		fallthrough
	case "usgov":
		fallthrough
	case "usgovernment":
		return AzureUSGovernment

	// Germany
	case "azuregermancloud":
		fallthrough
	case "azuregermany":
		fallthrough
	case "german":
		fallthrough
	case "germany":
		return AzureGermany
	}

	// Pass the name unchanged if it's not known
	return cloudName
}

package setting

import "strings"

const (
	AzurePublic       = "AzureCloud"
	AzureChina        = "AzureChinaCloud"
	AzureUSGovernment = "AzureUSGovernment"
	AzureGermany      = "AzureGermanCloud"
)

type AzureSettings struct {
	Cloud                     string
	ManagedIdentityEnabled    bool
	ManagedIdentityClientId   string
	UserIdentityEnabled       bool
	UserIdentityTokenEndpoint string
	UserIdentityAuthHeader    string
}

func (cfg *Cfg) readAzureSettings() {
	azureSection := cfg.Raw.Section("azure")

	// Cloud
	cloudName := azureSection.Key("cloud").MustString(AzurePublic)
	cfg.Azure.Cloud = normalizeAzureCloud(cloudName)

	// Managed Identity
	cfg.Azure.ManagedIdentityEnabled = azureSection.Key("managed_identity_enabled").MustBool(false)
	cfg.Azure.ManagedIdentityClientId = azureSection.Key("managed_identity_client_id").String()
	// User Identity toke endpoint
	cfg.Azure.UserIdentityEnabled = azureSection.Key("user_identity_enabled").MustBool(false)
	cfg.Azure.UserIdentityTokenEndpoint = azureSection.Key("user_identity_token_endpoint").String()
	cfg.Azure.UserIdentityAuthHeader = azureSection.Key("user_identity_auth_header").String()

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

package setting

import (
	"github.com/grafana/grafana-azure-sdk-go/azsettings"
)

func (cfg *Cfg) readAzureSettings() {
	azureSettings := &azsettings.AzureSettings{}

	azureSection := cfg.Raw.Section("azure")

	// Cloud
	cloudName := azureSection.Key("cloud").MustString(azsettings.AzurePublic)
	azureSettings.Cloud = azsettings.NormalizeAzureCloud(cloudName)

	// Managed Identity authentication
	azureSettings.ManagedIdentityEnabled = azureSection.Key("managed_identity_enabled").MustBool(false)
	azureSettings.ManagedIdentityClientId = azureSection.Key("managed_identity_client_id").String()

	// User Identity authentication
	if azureSection.Key("user_identity_enabled").MustBool(false) {
		azureSettings.UserIdentityEnabled = true
		tokenEndpointSettings := &azsettings.TokenEndpointSettings{}

		// Get token endpoint from Azure AD settings if enabled
		azureAdSection := cfg.Raw.Section("auth.azuread")
		if azureAdSection.Key("enabled").MustBool(false) {
			tokenEndpointSettings.TokenUrl = azureAdSection.Key("token_url").String()
			tokenEndpointSettings.ClientId = azureAdSection.Key("client_id").String()
			tokenEndpointSettings.ClientSecret = azureAdSection.Key("client_secret").String()
		}

		// Override individual settings
		if val := azureSection.Key("user_identity_token_url").String(); val != "" {
			tokenEndpointSettings.TokenUrl = val
		}
		if val := azureSection.Key("user_identity_client_id").String(); val != "" {
			tokenEndpointSettings.ClientId = val
		}
		if val := azureSection.Key("user_identity_client_secret").String(); val != "" {
			tokenEndpointSettings.ClientSecret = val
		}

		azureSettings.UserIdentityTokenEndpoint = tokenEndpointSettings
	}

	cfg.Azure = azureSettings
}

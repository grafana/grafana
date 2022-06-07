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
		azureSettings.UserIdentityTokenEndpoint = &azsettings.TokenEndpointSettings{
			TokenUrl:     azureSection.Key("user_identity_token_url").String(),
			ClientId:     azureSection.Key("user_identity_client_id").String(),
			ClientSecret: azureSection.Key("user_identity_client_secret").String(),
		}
	}

	cfg.Azure = azureSettings
}

package setting

import "github.com/grafana/grafana-azure-sdk-go/azsettings"

func (cfg *Cfg) readAzureSettings() {
	azureSettings := &azsettings.AzureSettings{}

	azureSection := cfg.Raw.Section("azure")

	// Cloud
	cloudName := azureSection.Key("cloud").MustString(azsettings.AzurePublic)
	azureSettings.Cloud = azsettings.NormalizeAzureCloud(cloudName)

	// Managed Identity
	azureSettings.ManagedIdentityEnabled = azureSection.Key("managed_identity_enabled").MustBool(false)
	azureSettings.ManagedIdentityClientId = azureSection.Key("managed_identity_client_id").String()

	cfg.Azure = azureSettings
}

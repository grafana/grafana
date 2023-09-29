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

	// Workload Identity authentication
	if azureSection.Key("workload_identity_enabled").MustBool(false) {
		azureSettings.WorkloadIdentityEnabled = true
		workloadIdentitySettings := &azsettings.WorkloadIdentitySettings{}

		if val := azureSection.Key("workload_identity_tenant_id").String(); val != "" {
			workloadIdentitySettings.TenantId = val
		}
		if val := azureSection.Key("workload_identity_client_id").String(); val != "" {
			workloadIdentitySettings.ClientId = val
		}
		if val := azureSection.Key("workload_identity_token_file").String(); val != "" {
			workloadIdentitySettings.TokenFile = val
		}

		azureSettings.WorkloadIdentitySettings = workloadIdentitySettings
	}

	cfg.Azure = azureSettings
}

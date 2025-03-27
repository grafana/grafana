package setting

import (
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana/pkg/util"
)

func (cfg *Cfg) readAzureSettings() {
	azureSettings := &azsettings.AzureSettings{}

	azureSection := cfg.Raw.Section("azure")
	authSection := cfg.Raw.Section("auth")

	// This setting is specific to Prometheus
	azureSettings.AzureAuthEnabled = authSection.Key("azure_auth_enabled").MustBool(false)

	// Cloud
	cloudName := azureSection.Key("cloud").MustString(azsettings.AzurePublic)
	azureSettings.Cloud = azsettings.NormalizeAzureCloud(cloudName)

	// Managed Identity authentication
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

	// User Identity authentication
	if azureSection.Key("user_identity_enabled").MustBool(false) {
		azureSettings.UserIdentityEnabled = true
		tokenEndpointSettings := &azsettings.TokenEndpointSettings{}

		// Get token endpoint from Azure AD settings if enabled
		azureAdSection := cfg.Raw.Section("auth.azuread")
		if azureAdSection.Key("enabled").MustBool(false) {
			tokenEndpointSettings.TokenUrl = azureAdSection.Key("token_url").String()
			tokenEndpointSettings.ClientAuthentication = azureAdSection.Key("client_authentication").String()
			tokenEndpointSettings.ClientId = azureAdSection.Key("client_id").String()
			tokenEndpointSettings.ClientSecret = azureAdSection.Key("client_secret").String()
			tokenEndpointSettings.ManagedIdentityClientId = azureAdSection.Key("managed_identity_client_id").String()
			tokenEndpointSettings.FederatedCredentialAudience = azureAdSection.Key("federated_credential_audience").String()
		}

		// Override individual settings
		if val := azureSection.Key("user_identity_token_url").String(); val != "" {
			tokenEndpointSettings.TokenUrl = val
		}
		if val := azureSection.Key("user_identity_client_authentication").String(); val != "" {
			tokenEndpointSettings.ClientAuthentication = val
		}
		if val := azureSection.Key("user_identity_client_id").String(); val != "" {
			tokenEndpointSettings.ClientId = val
			tokenEndpointSettings.ClientSecret = ""
		}
		if val := azureSection.Key("user_identity_client_secret").String(); val != "" {
			tokenEndpointSettings.ClientSecret = val
		}
		if val := azureSection.Key("user_identity_managed_identity_client_id").String(); val != "" {
			tokenEndpointSettings.ManagedIdentityClientId = val
		}
		if val := azureSection.Key("user_identity_federated_credential_audience").String(); val != "" {
			tokenEndpointSettings.FederatedCredentialAudience = val
		}
		if val := azureSection.Key("username_assertion").String(); val != "" && val == "username" {
			tokenEndpointSettings.UsernameAssertion = true
		}

		azureSettings.UserIdentityTokenEndpoint = tokenEndpointSettings
		azureSettings.UserIdentityFallbackCredentialsEnabled = azureSection.Key("user_identity_fallback_credentials_enabled").MustBool(true)
	}

	if customCloudsJSON := azureSection.Key("clouds_config").MustString(""); customCloudsJSON != "" {
		if err := azureSettings.SetCustomClouds(customCloudsJSON); err != nil {
			cfg.Logger.Error("Failed to parse custom Azure cloud settings", "err", err.Error())
		}
	}

	azureSettings.ForwardSettingsPlugins = util.SplitString(azureSection.Key("forward_settings_to_plugins").String())

	azureSettings.AzureEntraPasswordCredentialsEnabled = azureSection.Key("azure_entra_password_credentials_enabled").MustBool(false)

	cfg.Azure = azureSettings
}

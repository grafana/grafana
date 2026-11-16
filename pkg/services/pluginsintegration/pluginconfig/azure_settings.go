package pluginconfig

import (
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsso"
)

// mergeAzureSettings merges the Azure AD settings from the SSO settings DB with the Azure AD settings from the config.
// Azure AD settings can be changed via the UI or SSO settings API
// They can also be overridden in the [azure] config section
// The order of precedence is:
// 1. [azure] config section (if the override flag is set)
// 2. SSO settings from the DB (if they exist)
// 3. [auth.azuread] config section (if enabled)
//
// currSettings is shared by every request of the process, so the merge writes into a copy.
func mergeAzureSettings(currSettings *azsettings.AzureSettings, azureAdSettings *pluginsso.Settings) *azsettings.AzureSettings {
	if azureAdSettings == nil || currSettings == nil {
		return currSettings
	}

	merged := *currSettings
	tokenEndpoint := azsettings.TokenEndpointSettings{}
	if currSettings.UserIdentityTokenEndpoint != nil {
		tokenEndpoint = *currSettings.UserIdentityTokenEndpoint
	}
	merged.UserIdentityTokenEndpoint = &tokenEndpoint

	settings := azureAdSettings.Values
	if tokenUrl, ok := settings["token_url"].(string); ok && !tokenEndpoint.TokenUrlOverride {
		tokenEndpoint.TokenUrl = tokenUrl
	}
	if clientAuth, ok := settings["client_authentication"].(string); ok && !tokenEndpoint.ClientAuthenticationOverride && clientAuth != "none" {
		tokenEndpoint.ClientAuthentication = clientAuth
	}
	if clientId, ok := settings["client_id"].(string); ok && !tokenEndpoint.ClientIdOverride {
		tokenEndpoint.ClientId = clientId
	}
	if clientSecret, ok := settings["client_secret"].(string); ok && !tokenEndpoint.ClientSecretOverride {
		tokenEndpoint.ClientSecret = clientSecret
	}
	if managedIdentityClientId, ok := settings["managed_identity_client_id"].(string); ok && !tokenEndpoint.ManagedIdentityClientIdOverride {
		tokenEndpoint.ManagedIdentityClientId = managedIdentityClientId
	}
	if federatedCredentialAudience, ok := settings["federated_credential_audience"].(string); ok && !tokenEndpoint.FederatedCredentialAudienceOverride {
		tokenEndpoint.FederatedCredentialAudience = federatedCredentialAudience
	}

	return &merged
}

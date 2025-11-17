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
func mergeAzureSettings(currSettings *azsettings.AzureSettings, azureAdSettings *pluginsso.Settings) *azsettings.AzureSettings {
	if azureAdSettings != nil {
		settings := azureAdSettings.Values
		tokenEndpointSettings := currSettings.UserIdentityTokenEndpoint
		if tokenEndpointSettings == nil {
			tokenEndpointSettings = &azsettings.TokenEndpointSettings{}
			currSettings.UserIdentityTokenEndpoint = tokenEndpointSettings
		}

		tokenUrl, ok := settings["token_url"].(string)
		if ok {
			if !currSettings.UserIdentityTokenEndpoint.TokenUrlOverride {
				currSettings.UserIdentityTokenEndpoint.TokenUrl = tokenUrl
			}
		}
		clientAuth, ok := settings["client_authentication"].(string)
		if ok {
			if !currSettings.UserIdentityTokenEndpoint.ClientAuthenticationOverride {
				if clientAuth != "none" {
					currSettings.UserIdentityTokenEndpoint.ClientAuthentication = clientAuth
				}
			}
		}
		clientId, ok := settings["client_id"].(string)
		if ok {
			if !currSettings.UserIdentityTokenEndpoint.ClientIdOverride {
				currSettings.UserIdentityTokenEndpoint.ClientId = clientId
			}
		}
		clientSecret, ok := settings["client_secret"].(string)
		if ok {
			if !currSettings.UserIdentityTokenEndpoint.ClientSecretOverride {
				currSettings.UserIdentityTokenEndpoint.ClientSecret = clientSecret
			}
		}
		managedIdentityClientId, ok := settings["managed_identity_client_id"].(string)
		if ok {
			if !currSettings.UserIdentityTokenEndpoint.ManagedIdentityClientIdOverride {
				currSettings.UserIdentityTokenEndpoint.ManagedIdentityClientId = managedIdentityClientId
			}
		}
		federatedCredentialAudience, ok := settings["federated_credential_audience"].(string)
		if ok {
			if !currSettings.UserIdentityTokenEndpoint.FederatedCredentialAudienceOverride {
				currSettings.UserIdentityTokenEndpoint.FederatedCredentialAudience = federatedCredentialAudience
			}
		}
	}

	return currSettings
}

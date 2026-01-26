package azure

import (
	"fmt"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
)

func GetAzureCredentialDSNFragment(azureCredentials azcredentials.AzureCredentials, azureSettings *azsettings.AzureSettings, userAssertion string) (string, error) {
	connStr := ""
	switch c := azureCredentials.(type) {
	case *azcredentials.AzureManagedIdentityCredentials:
		if azureSettings.ManagedIdentityClientId != "" {
			connStr += fmt.Sprintf("user id=%s;", azureSettings.ManagedIdentityClientId)
		}
		connStr += fmt.Sprintf("fedauth=%s;",
			"ActiveDirectoryManagedIdentity")
	case *azcredentials.AzureClientSecretCredentials:
		connStr += fmt.Sprintf("user id=%s@%s;password=%s;fedauth=%s;",
			c.ClientId,
			c.TenantId,
			c.ClientSecret,
			"ActiveDirectoryApplication",
		)
	case *azcredentials.AzureEntraPasswordCredentials:
		if azureSettings.AzureEntraPasswordCredentialsEnabled {
			connStr += fmt.Sprintf("user id=%s;password=%s;applicationclientid=%s;fedauth=%s;",
				c.UserId,
				c.Password,
				c.ClientId,
				"ActiveDirectoryPassword",
			)
		} else {
			return "", fmt.Errorf("azure entra password authentication is not enabled")
		}
	case *azcredentials.AadCurrentUserCredentials:
		if userAssertion == "" {
			return "", fmt.Errorf("user ID token is empty but required for current user authentication")
		}
		connStr += fmt.Sprintf("user id=%s;userassertion=%s;password=%s;fedauth=%s;",
			azureSettings.UserIdentityTokenEndpoint.ClientId, userAssertion, azureSettings.UserIdentityTokenEndpoint.ClientSecret, "ActiveDirectoryOnBehalfOf")
	default:
		return "", fmt.Errorf("unsupported azure authentication type")
	}
	return connStr, nil
}

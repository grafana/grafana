package azure

import (
	"fmt"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
)

func GetAzureCredentialDSNFragment(azureCredentials azcredentials.AzureCredentials, azureManagedIdentityClientId string, azureEntraPasswordCredentialsEnabled bool) (string, error) {
	connStr := ""
	switch c := azureCredentials.(type) {
	case *azcredentials.AzureManagedIdentityCredentials:
		if azureManagedIdentityClientId != "" {
			connStr += fmt.Sprintf("user id=%s;", azureManagedIdentityClientId)
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
		if azureEntraPasswordCredentialsEnabled {
			connStr += fmt.Sprintf("user id=%s;password=%s;applicationclientid=%s;fedauth=%s;",
				c.UserId,
				c.Password,
				c.ClientId,
				"ActiveDirectoryPassword",
			)
		} else {
			return "", fmt.Errorf("azure entra password authentication is not enabled")
		}
	default:
		return "", fmt.Errorf("unsupported azure authentication type")
	}
	return connStr, nil
}

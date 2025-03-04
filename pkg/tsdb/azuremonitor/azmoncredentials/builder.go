package azmoncredentials

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data/utils/maputil"
)

func FromDatasourceData(data map[string]interface{}, secureData map[string]string) (azcredentials.AzureCredentials, error) {
	var credentials azcredentials.AzureCredentials
	var err error

	credentials, err = azcredentials.FromDatasourceData(data, secureData)
	if err != nil {
		return nil, err
	}

	// Fallback to legacy credentials format
	if credentials == nil {
		credentials, err = getFromLegacy(data, secureData)
		if err != nil {
			return nil, err
		}
	}

	return credentials, err
}

func getFromLegacy(data map[string]interface{}, secureData map[string]string) (azcredentials.AzureCredentials, error) {
	authType, err := maputil.GetStringOptional(data, "azureAuthType")
	if err != nil {
		return nil, err
	}
	tenantId, err := maputil.GetStringOptional(data, "tenantId")
	if err != nil {
		return nil, err
	}
	clientId, err := maputil.GetStringOptional(data, "clientId")
	if err != nil {
		return nil, err
	}

	if authType == "" {
		// Some very old legacy datasources may not have explicit auth type specified,
		// but they imply App Registration authentication
		if tenantId != "" && clientId != "" {
			authType = azcredentials.AzureAuthClientSecret
		} else {
			// No configuration present
			return nil, nil
		}
	}

	switch authType {
	case azcredentials.AzureAuthManagedIdentity:
		credentials := &azcredentials.AzureManagedIdentityCredentials{}
		return credentials, nil

	case azcredentials.AzureAuthWorkloadIdentity:
		credentials := &azcredentials.AzureWorkloadIdentityCredentials{}
		return credentials, nil

	case azcredentials.AzureAuthCurrentUserIdentity:
		legacyCloud, err := maputil.GetStringOptional(data, "cloudName")
		if err != nil {
			return nil, err
		}
		cloud, err := resolveLegacyCloudName(legacyCloud)
		if err != nil {
			return nil, err
		}
		clientSecret := secureData["clientSecret"]

		credentials := &azcredentials.AadCurrentUserCredentials{
			ServiceCredentials: &azcredentials.AzureClientSecretCredentials{
				AzureCloud:   cloud,
				TenantId:     tenantId,
				ClientId:     clientId,
				ClientSecret: clientSecret,
			},
		}

		return credentials, nil
	case azcredentials.AzureAuthClientSecret:
		legacyCloud, err := maputil.GetStringOptional(data, "cloudName")
		if err != nil {
			return nil, err
		}
		cloud, err := resolveLegacyCloudName(legacyCloud)
		if err != nil {
			return nil, err
		}
		clientSecret := secureData["clientSecret"]

		if secureData["clientSecret"] == "" {
			return nil, backend.DownstreamError(errors.New("unable to instantiate credentials, clientSecret must be set"))
		}

		credentials := &azcredentials.AzureClientSecretCredentials{
			AzureCloud:   cloud,
			TenantId:     tenantId,
			ClientId:     clientId,
			ClientSecret: clientSecret,
		}

		return credentials, nil

	default:
		err := fmt.Errorf("the authentication type '%s' not supported", authType)
		return nil, err
	}
}

// Legacy Azure cloud names used by the Azure Monitor datasource
const (
	azureMonitorPublic       = "azuremonitor"
	azureMonitorChina        = "chinaazuremonitor"
	azureMonitorUSGovernment = "govazuremonitor"
	azureMonitorCustomized   = "customizedazuremonitor"
)

func resolveLegacyCloudName(cloudName string) (string, error) {
	switch cloudName {
	case azureMonitorPublic:
		return azsettings.AzurePublic, nil
	case azureMonitorChina:
		return azsettings.AzureChina, nil
	case azureMonitorUSGovernment:
		return azsettings.AzureUSGovernment, nil
	case azureMonitorCustomized:
		return azsettings.AzureCustomized, nil
	case "":
		return azsettings.AzurePublic, nil
	default:
		err := fmt.Errorf("the Azure cloud '%s' not supported by Azure Monitor datasource", cloudName)
		return "", err
	}
}

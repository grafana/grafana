package azuremonitor

import (
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
)

func getAuthType(cfg *setting.Cfg, dsInfo datasourceInfo) string {
	if dsInfo.Settings.AzureAuthType != "" {
		return dsInfo.Settings.AzureAuthType
	} else {
		tenantId := dsInfo.Settings.TenantId
		clientId := dsInfo.Settings.ClientId

		// If authentication type isn't explicitly specified and datasource has client credentials,
		// then this is existing datasource which is configured for app registration (client secret)
		if tenantId != "" && clientId != "" {
			return azcredentials.AzureAuthClientSecret
		}

		// For newly created datasource with no configuration, managed identity is the default authentication type
		// if they are enabled in Grafana config
		if cfg.Azure.ManagedIdentityEnabled {
			return azcredentials.AzureAuthManagedIdentity
		} else {
			return azcredentials.AzureAuthClientSecret
		}
	}
}

func getDefaultAzureCloud(cfg *setting.Cfg) (string, error) {
	switch cfg.Azure.Cloud {
	case setting.AzurePublic:
		return setting.AzurePublic, nil
	case setting.AzureChina:
		return setting.AzureChina, nil
	case setting.AzureUSGovernment:
		return setting.AzureUSGovernment, nil
	case setting.AzureGermany:
		return setting.AzureGermany, nil
	default:
		err := fmt.Errorf("the cloud '%s' not supported", cfg.Azure.Cloud)
		return "", err
	}
}

func getAzureCloud(cfg *setting.Cfg, dsInfo datasourceInfo) (string, error) {
	authType := getAuthType(cfg, dsInfo)
	switch authType {
	case azcredentials.AzureAuthManagedIdentity:
		// In case of managed identity, the cloud is always same as where Grafana is hosted
		return getDefaultAzureCloud(cfg)
	case azcredentials.AzureAuthClientSecret:
		if dsInfo.Settings.CloudName != "" {
			return dsInfo.Settings.CloudName, nil
		} else {
			return getDefaultAzureCloud(cfg)
		}
	default:
		err := fmt.Errorf("the authentication type '%s' not supported", authType)
		return "", err
	}
}

func getAzureCredentials(cfg *setting.Cfg, dsInfo datasourceInfo) (azcredentials.AzureCredentials, error) {
	authType := getAuthType(cfg, dsInfo)
	switch authType {
	case azcredentials.AzureAuthManagedIdentity:
		credentials := &azcredentials.AzureManagedIdentityCredentials{}
		return credentials, nil
	case azcredentials.AzureAuthClientSecret:
		cloud, err := getAzureCloud(cfg, dsInfo)
		if err != nil {
			return nil, err
		}
		credentials := &azcredentials.AzureClientSecretCredentials{
			AzureCloud:   cloud,
			TenantId:     dsInfo.Settings.TenantId,
			ClientId:     dsInfo.Settings.ClientId,
			ClientSecret: dsInfo.DecryptedSecureJSONData["clientSecret"],
		}
		return credentials, nil
	default:
		err := fmt.Errorf("the authentication type '%s' not supported", authType)
		return nil, err
	}
}

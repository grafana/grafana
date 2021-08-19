package azuremonitor

import (
	"fmt"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
)

// Azure cloud names specific to Azure Monitor
const (
	azureMonitorPublic       = "azuremonitor"
	azureMonitorChina        = "chinaazuremonitor"
	azureMonitorUSGovernment = "govazuremonitor"
	azureMonitorGermany      = "germanyazuremonitor"
)

func getAuthType(cfg *setting.Cfg, jsonData *simplejson.Json) string {
	if azureAuthType := jsonData.Get("azureAuthType").MustString(); azureAuthType != "" {
		return azureAuthType
	} else {
		tenantId := jsonData.Get("tenantId").MustString()
		clientId := jsonData.Get("clientId").MustString()

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
	// Allow only known cloud names
	cloudName := cfg.Azure.Cloud
	switch cloudName {
	case setting.AzurePublic:
		return setting.AzurePublic, nil
	case setting.AzureChina:
		return setting.AzureChina, nil
	case setting.AzureUSGovernment:
		return setting.AzureUSGovernment, nil
	case setting.AzureGermany:
		return setting.AzureGermany, nil
	case "":
		// Not set cloud defaults to public
		return setting.AzurePublic, nil
	default:
		err := fmt.Errorf("the cloud '%s' not supported", cloudName)
		return "", err
	}
}

func normalizeAzureCloud(cloudName string) (string, error) {
	switch cloudName {
	case azureMonitorPublic:
		return setting.AzurePublic, nil
	case azureMonitorChina:
		return setting.AzureChina, nil
	case azureMonitorUSGovernment:
		return setting.AzureUSGovernment, nil
	case azureMonitorGermany:
		return setting.AzureGermany, nil
	default:
		err := fmt.Errorf("the cloud '%s' not supported", cloudName)
		return "", err
	}
}

func getAzureCloud(cfg *setting.Cfg, jsonData *simplejson.Json) (string, error) {
	authType := getAuthType(cfg, jsonData)
	switch authType {
	case azcredentials.AzureAuthManagedIdentity:
		// In case of managed identity, the cloud is always same as where Grafana is hosted
		return getDefaultAzureCloud(cfg)
	case azcredentials.AzureAuthClientSecret:
		if cloud := jsonData.Get("cloudName").MustString(); cloud != "" {
			return normalizeAzureCloud(cloud)
		} else {
			return getDefaultAzureCloud(cfg)
		}
	default:
		err := fmt.Errorf("the authentication type '%s' not supported", authType)
		return "", err
	}
}

func getAzureCredentials(cfg *setting.Cfg, jsonData *simplejson.Json, secureJsonData map[string]string) (azcredentials.AzureCredentials, error) {
	authType := getAuthType(cfg, jsonData)

	switch authType {
	case azcredentials.AzureAuthManagedIdentity:
		credentials := &azcredentials.AzureManagedIdentityCredentials{}
		return credentials, nil

	case azcredentials.AzureAuthClientSecret:
		cloud, err := getAzureCloud(cfg, jsonData)
		if err != nil {
			return nil, err
		}
		credentials := &azcredentials.AzureClientSecretCredentials{
			AzureCloud:   cloud,
			TenantId:     jsonData.Get("tenantId").MustString(),
			ClientId:     jsonData.Get("clientId").MustString(),
			ClientSecret: secureJsonData["clientSecret"],
		}
		return credentials, nil

	default:
		err := fmt.Errorf("the authentication type '%s' not supported", authType)
		return nil, err
	}
}

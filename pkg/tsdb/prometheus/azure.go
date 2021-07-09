package prometheus

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
)

func isAzureAuthenticationEnabled(jsonData *simplejson.Json) bool {
	return jsonData.Get("azureAuth").MustBool()
}

func getAzureAuthType(cfg *setting.Cfg, jsonData *simplejson.Json) string {
	if azureAuthType := jsonData.Get("azureAuthType").MustString(); azureAuthType != "" {
		return azureAuthType
	} else {
		// For datasource with no configuration, managed identity is the default authentication type
		// if it's enabled in Grafana config
		if cfg.Azure.ManagedIdentityEnabled {
			return azcredentials.AzureAuthManagedIdentity
		} else {
			return azcredentials.AzureAuthClientSecret
		}
	}
}

func getDefaultAzureCloud(cfg *setting.Cfg) string {
	cloudName := cfg.Azure.Cloud
	if cloudName == "" {
		return setting.AzurePublic
	}
	return cloudName
}

func getAzureCloud(cfg *setting.Cfg, jsonData *simplejson.Json) (string, error) {
	authType := getAzureAuthType(cfg, jsonData)
	switch authType {
	case azcredentials.AzureAuthManagedIdentity:
		// In case of managed identity, the cloud is always same as where Grafana is hosted
		return getDefaultAzureCloud(cfg), nil
	case azcredentials.AzureAuthClientSecret:
		if cloud := jsonData.Get("azureCloud").MustString(); cloud != "" {
			return cloud, nil
		} else {
			return getDefaultAzureCloud(cfg), nil
		}
	default:
		err := fmt.Errorf("the authentication type '%s' not supported", authType)
		return "", err
	}
}

func getAzureCloudFromCredentials(cfg *setting.Cfg, credentials azcredentials.AzureCredentials) (string, error) {
	switch c := credentials.(type) {
	case *azcredentials.AzureManagedIdentityCredentials:
		// In case of managed identity, the cloud is always same as where Grafana is hosted
		return getDefaultAzureCloud(cfg), nil
	case *azcredentials.AzureClientSecretCredentials:
		return c.AzureCloud, nil
	default:
		err := fmt.Errorf("credentials of type '%s' not supported", c.AzureAuthType())
		return "", err
	}
}

func getAzureCredentials(cfg *setting.Cfg, jsonData *simplejson.Json, secureJsonData map[string]string) (azcredentials.AzureCredentials, error) {
	if !isAzureAuthenticationEnabled(jsonData) {
		return nil, nil
	}

	authType := getAzureAuthType(cfg, jsonData)

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
			TenantId:     jsonData.Get("azureTenantId").MustString(),
			ClientId:     jsonData.Get("azureClientId").MustString(),
			ClientSecret: secureJsonData["azureClientSecret"],
		}
		return credentials, nil

	default:
		err := fmt.Errorf("the authentication type '%s' not supported", authType)
		return nil, err
	}
}

type azureEndpointInfo struct {
	cloud      string
	resourceId string
}

var (
	azureEndpoints = map[string]azureEndpointInfo{
		"https://prometheus.azure.net":         {cloud: setting.AzurePublic, resourceId: "https://prometheus.azure.net/.default"},
		"https://prometheus.chinacloudapi.cn":  {cloud: setting.AzureChina, resourceId: "https://prometheus.chinacloudapi.cn/.default"},
		"https://prometheus.usgovcloudapi.net": {cloud: setting.AzureUSGovernment, resourceId: "https://prometheus.usgovcloudapi.net/.default"},
		"https://prometheus.cloudapi.de":       {cloud: setting.AzureGermany, resourceId: "https://prometheus.cloudapi.de/.default"},
	}
)

func getAzureEndpointScopes(cfg *setting.Cfg, credentials azcredentials.AzureCredentials, datasourceUrl string) ([]string, error) {
	parsedUrl, err := url.Parse(datasourceUrl)
	if err != nil {
		err := fmt.Errorf("invalid endpoint URL '%s'", datasourceUrl)
		return nil, err
	}

	endpointHost := strings.ToLower(fmt.Sprintf("%s://%s", parsedUrl.Scheme, parsedUrl.Host))
	if endpoint, ok := azureEndpoints[endpointHost]; !ok {
		err := fmt.Errorf("given endpoint '%s' is not known Azure endpoint, cannot use Azure authentication", datasourceUrl)
		return nil, err
	} else {
		cloud, err := getAzureCloudFromCredentials(cfg, credentials)
		if err != nil {
			return nil, err
		}

		if endpoint.cloud != cloud {
			err := fmt.Errorf("given Azure endpoint '%s' doesn't match the cloud of Azure credentials '%s'", datasourceUrl, cloud)
			return nil, err
		}

		return []string{endpoint.resourceId}, nil
	}
}

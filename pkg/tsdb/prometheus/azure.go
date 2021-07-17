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

func getAzureEndpointScopes(jsonData *simplejson.Json) ([]string, error) {
	resourceId, err := url.Parse(jsonData.Get("azurePrometheusResourceId").MustString())
	if err != nil || resourceId.Scheme == "" || resourceId.Host == "" {
		err := fmt.Errorf("invalid endpoint Resource ID URL '%s'", resourceId)
		return nil, err
	}

	resourceId.Path = strings.TrimRight(resourceId.Path, "/") + "/.default"
	scopes := []string{resourceId.String()}

	return scopes, nil
}

package promclient

import (
	"fmt"
	"net/url"
	"path"

	"github.com/grafana/grafana-azure-sdk-go/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/azhttpclient"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util/maputil"
)

var (
	azurePrometheusScopes = map[string][]string{
		azsettings.AzurePublic:       {"https://prometheus.monitor.azure.com/.default"},
		azsettings.AzureChina:        {"https://prometheus.monitor.chinacloudapp.cn/.default"},
		azsettings.AzureUSGovernment: {"https://prometheus.monitor.usgovcloudapi.net/.default"},
	}
)

func (p *Provider) configureAzureAuthentication(opts *sdkhttpclient.Options) error {
	// Azure authentication is experimental (#35857)
	if !p.features.IsEnabled(featuremgmt.FlagPrometheusAzureAuth) {
		return nil
	}

	credentials, err := azcredentials.FromDatasourceData(p.jsonData, p.settings.DecryptedSecureJSONData)
	if err != nil {
		err = fmt.Errorf("invalid Azure credentials: %w", err)
		return err
	}

	if credentials != nil {
		var scopes []string

		if scopes, err = GetOverriddenScopes(p.jsonData); err != nil {
			return err
		}

		if scopes == nil {
			if scopes, err = GetPrometheusScopes(p.cfg.Azure, credentials); err != nil {
				return err
			}
		}

		azhttpclient.AddAzureAuthentication(opts, p.cfg.Azure, credentials, scopes)
	}

	return nil
}

func GetOverriddenScopes(jsonData map[string]interface{}) ([]string, error) {
	resourceIdStr, err := maputil.GetStringOptional(jsonData, "azureEndpointResourceId")
	if err != nil {
		err = fmt.Errorf("overridden resource ID (audience) invalid")
		return nil, err
	} else if resourceIdStr == "" {
		return nil, nil
	}

	resourceId, err := url.Parse(resourceIdStr)
	if err != nil || resourceId.Scheme == "" || resourceId.Host == "" {
		err = fmt.Errorf("overridden endpoint resource ID (audience) '%s' invalid", resourceIdStr)
		return nil, err
	}

	resourceId.Path = path.Join(resourceId.Path, ".default")
	scopes := []string{resourceId.String()}
	return scopes, nil
}

func GetPrometheusScopes(settings *azsettings.AzureSettings, credentials azcredentials.AzureCredentials) ([]string, error) {
	// Extract cloud from credentials
	azureCloud, err := getAzureCloudFromCredentials(settings, credentials)
	if err != nil {
		return nil, err
	}

	// Get scopes for the given cloud
	if scopes, ok := azurePrometheusScopes[azureCloud]; !ok {
		err := fmt.Errorf("the Azure cloud '%s' not supported by Prometheus datasource", azureCloud)
		return nil, err
	} else {
		return scopes, nil
	}
}

// To be part of grafana-azure-sdk-go
func getAzureCloudFromCredentials(settings *azsettings.AzureSettings, credentials azcredentials.AzureCredentials) (string, error) {
	switch c := credentials.(type) {
	case *azcredentials.AzureManagedIdentityCredentials:
		// In case of managed identity, the cloud is always same as where Grafana is hosted
		return getDefaultAzureCloud(settings), nil
	case *azcredentials.AzureClientSecretCredentials:
		return c.AzureCloud, nil
	default:
		err := fmt.Errorf("the Azure credentials of type '%s' not supported by Prometheus datasource", c.AzureAuthType())
		return "", err
	}
}

// To be part of grafana-azure-sdk-go
func getDefaultAzureCloud(settings *azsettings.AzureSettings) string {
	cloudName := settings.Cloud
	if cloudName == "" {
		return azsettings.AzurePublic
	}
	return cloudName
}

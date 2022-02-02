package promclient

import (
	"fmt"

	"github.com/grafana/grafana-azure-sdk-go/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/azhttpclient"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
		err = fmt.Errorf("invalid Azure credentials: %s", err)
		return err
	}

	if credentials != nil {
		// If credentials configured then resolve the scopes which are relevant to the given credentials
		scopes, err := getAzureScopes(p.cfg.Azure, credentials)
		if err != nil {
			return err
		}

		azhttpclient.AddAzureAuthentication(opts, p.cfg.Azure, credentials, scopes)
	}

	return nil
}

func getAzureScopes(settings *azsettings.AzureSettings, credentials azcredentials.AzureCredentials) ([]string, error) {
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

package azureauth

import (
	"fmt"
	"net/url"
	"path"

	"github.com/grafana/grafana-azure-sdk-go/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/azhttpclient"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-azure-sdk-go/util/maputil"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/promlib/utils"
)

func ConfigureAzureAuthentication(settings backend.DataSourceInstanceSettings, azureSettings *azsettings.AzureSettings, clientOpts *sdkhttpclient.Options) error {
	jsonData, err := utils.GetJsonData(settings)
	if err != nil {
		return fmt.Errorf("failed to get jsonData: %w", err)
	}
	credentials, err := azcredentials.FromDatasourceData(jsonData, settings.DecryptedSecureJSONData)
	if err != nil {
		err = fmt.Errorf("invalid Azure credentials: %w", err)
		return err
	}

	if credentials != nil {
		var scopes []string

		if scopes, err = getOverriddenScopes(jsonData); err != nil {
			return err
		}

		if scopes == nil {
			if scopes, err = getPrometheusScopes(azureSettings, credentials); err != nil {
				return err
			}
		}

		authOpts := azhttpclient.NewAuthOptions(azureSettings)
		authOpts.Scopes(scopes)
		azhttpclient.AddAzureAuthentication(clientOpts, authOpts, credentials)
	}

	return nil
}

func getOverriddenScopes(jsonData map[string]any) ([]string, error) {
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

func getPrometheusScopes(settings *azsettings.AzureSettings, credentials azcredentials.AzureCredentials) ([]string, error) {
	// Extract cloud from credentials
	azureCloud, err := azcredentials.GetAzureCloud(settings, credentials)
	if err != nil {
		return nil, err
	}

	cloudSettings, err := settings.GetCloud(azureCloud)
	if err != nil {
		return nil, err
	}

	// Get scopes for the given cloud
	resourceIdS, ok := cloudSettings.Properties["prometheusResourceId"]
	if !ok {
		err := fmt.Errorf("the Azure cloud '%s' doesn't have configuration for Prometheus", azureCloud)
		return nil, err
	}
	return audienceToScopes(resourceIdS)
}

func audienceToScopes(audience string) ([]string, error) {
	resourceId, err := url.Parse(audience)
	if err != nil || resourceId.Scheme == "" || resourceId.Host == "" {
		err = fmt.Errorf("endpoint resource ID (audience) '%s' invalid", audience)
		return nil, err
	}

	resourceId.Path = path.Join(resourceId.Path, ".default")
	scopes := []string{resourceId.String()}
	return scopes, nil
}

package promclient

import (
	"fmt"
	"net/url"
	"path"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/grafana/grafana/pkg/util/maputil"
)

func (p *Provider) configureAzureAuthentication(opts sdkhttpclient.Options) error {
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
		opts.CustomOptions["_azureCredentials"] = credentials

		resourceIdStr, err := maputil.GetStringOptional(p.jsonData, "azureEndpointResourceId")
		if err != nil {
			return err
		}

		if resourceIdStr != "" {
			resourceId, err := url.Parse(resourceIdStr)
			if err != nil || resourceId.Scheme == "" || resourceId.Host == "" {
				err := fmt.Errorf("invalid endpoint Resource ID URL '%s'", resourceIdStr)
				return err
			}

			resourceId.Path = path.Join(resourceId.Path, ".default")
			scopes := []string{resourceId.String()}
			opts.CustomOptions["_azureScopes"] = scopes
		}
	}

	return nil
}

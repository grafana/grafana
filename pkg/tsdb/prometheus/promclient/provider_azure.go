package promclient

import (
	"fmt"
	"net/url"
	"path"

	"github.com/grafana/grafana-azure-sdk-go/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/azhttpclient"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util/maputil"
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
		resourceIdStr, err := maputil.GetStringOptional(p.jsonData, "azureEndpointResourceId")
		if err != nil {
			return err
		} else if resourceIdStr == "" {
			err := fmt.Errorf("endpoint resource ID (audience) not provided")
			return err
		}

		resourceId, err := url.Parse(resourceIdStr)
		if err != nil || resourceId.Scheme == "" || resourceId.Host == "" {
			err := fmt.Errorf("endpoint resource ID (audience) '%s' invalid", resourceIdStr)
			return err
		}

		resourceId.Path = path.Join(resourceId.Path, ".default")
		scopes := []string{resourceId.String()}

		azhttpclient.AddAzureAuthentication(opts, p.cfg.Azure, credentials, scopes)
	}

	return nil
}

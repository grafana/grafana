package promclient

import (
	"fmt"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/grafana/grafana/pkg/util/maputil"
)

func (p *Provider) configureAzureAuthentication(opts sdkhttpclient.Options) error {
	credentials, err := azcredentials.FromDatasourceData(p.jsonData, p.settings.DecryptedSecureJSONData)
	if err != nil {
		err = fmt.Errorf("invalid Azure credentials: %s", err)
		return err
	}

	if credentials != nil {
		opts.CustomOptions["_azureCredentials"] = credentials

		resourceId, err := maputil.GetStringOptional(p.jsonData, "azureEndpointResourceId")
		if err != nil {
			return err
		}

		if resourceId != "" {
			opts.CustomOptions["azureEndpointResourceId"] = resourceId
		}
	}

	return nil
}

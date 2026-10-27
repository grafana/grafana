package azuremonitor

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azhttpclient"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

type Provider interface {
	New(...httpclient.Options) (*http.Client, error)
	GetTransport(...httpclient.Options) (http.RoundTripper, error)
	GetTLSConfig(...httpclient.Options) (*tls.Config, error)
}

func newHTTPClient(ctx context.Context, route types.AzRoute, model types.DatasourceInfo, settings *backend.DataSourceInstanceSettings, azureSettings *azsettings.AzureSettings, clientProvider Provider) (*http.Client, error) {
	clientOpts, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting HTTP options: %w", err)
	}

	for header, value := range route.Headers {
		clientOpts.Header.Add(header, value)
	}

	// Use Azure credentials if the route has OAuth scopes configured
	if len(route.Scopes) > 0 {
		if cred, ok := model.Credentials.(*azcredentials.AzureClientSecretCredentials); ok && cred.ClientSecret == "" {
			return nil, backend.DownstreamError(errors.New("unable to initialize HTTP Client: clientSecret not found"))
		}

		authOpts := azhttpclient.NewAuthOptions(azureSettings)
		authOpts.AllowUserIdentity()
		// Allows requests from the same identity but different Grafana users to be identified as such by the server
		authOpts.AddRateLimitSession(true)
		authOpts.Scopes(route.Scopes)
		if route.URL != "" {
			// The SDK attaches the Azure token only for hosts on this list.
			// "*.host" matches any subdomain of the route host, so regional
			// data-plane hosts such as westus2.metrics.monitor.azure.com stay reachable.
			endpoints, err := azureAllowedEndpoints(route.URL)
			if err != nil {
				return nil, err
			}
			if err := authOpts.AllowedEndpoints(endpoints); err != nil {
				return nil, fmt.Errorf("failed to configure Azure endpoint allow list: %w", err)
			}
		}
		azhttpclient.AddAzureAuthentication(&clientOpts, authOpts, model.Credentials)
	}

	return clientProvider.New(clientOpts)
}

func azureAllowedEndpoints(routeURL string) ([]string, error) {
	u, err := url.Parse(routeURL)
	if err != nil || u.Scheme == "" || u.Hostname() == "" {
		return nil, fmt.Errorf("invalid Azure route URL %q", routeURL)
	}
	return []string{
		routeURL,
		u.Scheme + "://*." + u.Hostname(),
	}, nil
}

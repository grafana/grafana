package azhttpclient

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azsettings"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/aztokenprovider"
)

const azureMiddlewareName = "AzureAuthentication"

func AzureMiddleware(settings *azsettings.AzureSettings, credentials azcredentials.AzureCredentials, scopes []string) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(azureMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		tokenProvider, err := aztokenprovider.NewAzureAccessTokenProvider(settings, credentials)
		if err != nil {
			return errorResponse(err)
		}

		return ApplyAzureAuth(tokenProvider, scopes, next)
	})
}

func ApplyAzureAuth(tokenProvider aztokenprovider.AzureTokenProvider, scopes []string, next http.RoundTripper) http.RoundTripper {
	return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		token, err := tokenProvider.GetAccessToken(req.Context(), scopes)
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve Azure access token: %w", err)
		}
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		return next.RoundTrip(req)
	})
}

func errorResponse(err error) http.RoundTripper {
	return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		return nil, fmt.Errorf("invalid Azure configuration: %s", err)
	})
}

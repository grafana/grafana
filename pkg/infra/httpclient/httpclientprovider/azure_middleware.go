package httpclientprovider

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/aztokenprovider"
)

const azureMiddlewareName = "AzureAuthentication.Provider"

func AzureMiddleware(cfg *setting.Cfg) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(azureMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		credentials, err := getAzureCredentials(opts.CustomOptions)
		if err != nil {
			return errorResponse(err)
		} else if credentials == nil {
			return next
		}

		scopes, err := getAzureEndpointScopes(opts.CustomOptions)
		if err != nil {
			return errorResponse(err)
		}

		tokenProvider, err := aztokenprovider.NewAzureAccessTokenProvider(cfg, credentials)
		if err != nil {
			return errorResponse(err)
		}

		return aztokenprovider.ApplyAuth(tokenProvider, scopes, next)
	})
}

func errorResponse(err error) http.RoundTripper {
	return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		return nil, fmt.Errorf("invalid Azure configuration: %s", err)
	})
}

func getAzureCredentials(customOptions map[string]interface{}) (azcredentials.AzureCredentials, error) {
	if untypedValue, ok := customOptions["_azureCredentials"]; !ok {
		return nil, nil
	} else if value, ok := untypedValue.(azcredentials.AzureCredentials); !ok {
		err := fmt.Errorf("the field 'azureCredentials' should be a valid credentials object")
		return nil, err
	} else {
		return value, nil
	}
}

func getAzureEndpointScopes(customOptions map[string]interface{}) ([]string, error) {
	var scopes []string
	if untypedValue, ok := customOptions["_azureScopes"]; !ok {
		err := fmt.Errorf("the field '_azureScopes' should be set")
		return nil, err
	} else if scopes, ok = untypedValue.([]string); !ok {
		err := fmt.Errorf("the field '_azureScopes' should be a string array of scopes")
		return nil, err
	}

	return scopes, nil
}

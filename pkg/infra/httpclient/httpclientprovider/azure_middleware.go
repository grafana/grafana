package httpclientprovider

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/aztokenprovider"
)

const azureMiddlewareName = "AzureAuthentication.Provider"

func AzureMiddleware(cfg *setting.Cfg) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(azureMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		if enabled, err := isAzureAuthenticationEnabled(opts.CustomOptions); err != nil {
			return errorResponse(err)
		} else if !enabled {
			return next
		}

		credentials, err := getAzureCredentials(opts.CustomOptions)
		if err != nil {
			return errorResponse(err)
		} else if credentials == nil {
			credentials = getDefaultAzureCredentials(cfg)
		}

		tokenProvider, err := aztokenprovider.NewAzureAccessTokenProvider(cfg, credentials)
		if err != nil {
			return errorResponse(err)
		}

		scopes, err := getAzureEndpointScopes(opts.CustomOptions)
		if err != nil {
			return errorResponse(err)
		}

		middleware := aztokenprovider.AuthMiddleware(tokenProvider, scopes)
		return middleware.CreateMiddleware(opts, next)
	})
}

func errorResponse(err error) http.RoundTripper {
	return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		return nil, fmt.Errorf("invalid Azure configuration: %s", err)
	})
}

func isAzureAuthenticationEnabled(customOptions map[string]interface{}) (bool, error) {
	if untypedValue, ok := customOptions["azureAuth"]; !ok {
		return false, nil
	} else if value, ok := untypedValue.(bool); !ok {
		err := fmt.Errorf("the field 'azureAuth' should be a bool")
		return false, err
	} else {
		return value, nil
	}
}

func getAzureCredentials(customOptions map[string]interface{}) (azcredentials.AzureCredentials, error) {
	if untypedValue, ok := customOptions["azureCredentials"]; !ok {
		return nil, nil
	} else if value, ok := untypedValue.(azcredentials.AzureCredentials); !ok {
		err := fmt.Errorf("the field 'azureCredentials' should be a valid credentials object")
		return nil, err
	} else {
		return value, nil
	}
}

func getDefaultAzureCredentials(cfg *setting.Cfg) azcredentials.AzureCredentials {
	if cfg.Azure.ManagedIdentityEnabled {
		return &azcredentials.AzureManagedIdentityCredentials{}
	} else {
		return &azcredentials.AzureClientSecretCredentials{
			AzureCloud: cfg.Azure.Cloud,
		}
	}
}

func getAzureEndpointScopes(customOptions map[string]interface{}) ([]string, error) {
	if untypedValue, ok := customOptions["azureEndpointResourceId"]; !ok {
		err := fmt.Errorf("the field 'azureEndpointResourceId' should be set")
		return nil, err
	} else if value, ok := untypedValue.(string); !ok {
		err := fmt.Errorf("the field 'azureEndpointResourceId' should be a string")
		return nil, err
	} else if resourceId, err := url.Parse(value); err != nil || resourceId.Scheme == "" || resourceId.Host == "" {
		err := fmt.Errorf("invalid endpoint Resource ID URL '%s'", resourceId)
		return nil, err
	} else {
		resourceId.Path = strings.TrimRight(resourceId.Path, "/") + "/.default"
		scopes := []string{resourceId.String()}

		return scopes, nil
	}
}

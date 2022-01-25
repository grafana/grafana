package promclient

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/middleware"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/api"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

type Provider struct {
	settings       backend.DataSourceInstanceSettings
	jsonData       JsonData
	clientProvider httpclient.Provider
	log            log.Logger
}

func NewProvider(
	settings backend.DataSourceInstanceSettings,
	jsonData JsonData,
	clientProvider httpclient.Provider,
	log log.Logger,
) *Provider {
	return &Provider{
		settings:       settings,
		jsonData:       jsonData,
		clientProvider: clientProvider,
		log:            log,
	}
}

type JsonData struct {
	Method       string `json:"httpMethod"`
	TimeInterval string `json:"timeInterval"`
}

func (p *Provider) GetClient(headers map[string]string) (apiv1.API, error) {
	opts, err := p.settings.HTTPClientOptions()
	if err != nil {
		return nil, err
	}

	opts.Middlewares = p.middlewares()
	opts.Headers = reqHeaders(headers)

	// Set SigV4 service namespace
	if opts.SigV4 != nil {
		opts.SigV4.Service = "aps"
	}

	if _, ok := opts.CustomOptions["_azureCredentials"]; !ok {
		if grafanaData, err := getMap(opts.CustomOptions, "grafanaData"); err == nil {
			if azureAuthEnabled, err := getBool(grafanaData, "azureAuth"); err == nil && azureAuthEnabled {
				credentials, err := azcredentials.FromDatasourceData(grafanaData, p.settings.DecryptedSecureJSONData)
				if err != nil {
					err = fmt.Errorf("invalid Azure credentials: %s", err)
					return nil, err
				}

				opts.CustomOptions["_azureAuth"] = true
				if credentials != nil {
					opts.CustomOptions["_azureCredentials"] = credentials
				}
			}
		}
	}

	if _, ok := opts.CustomOptions["azureEndpointResourceId"]; !ok {
		if grafanaData, err := getMap(opts.CustomOptions, "grafanaData"); err == nil {
			if azureEndpointResourceId, err := getStringOptional(grafanaData, "azureEndpointResourceId"); err == nil {
				opts.CustomOptions["azureEndpointResourceId"] = azureEndpointResourceId
			}
		}
	}

	roundTripper, err := p.clientProvider.GetTransport(opts)
	if err != nil {
		return nil, err
	}

	cfg := api.Config{
		Address:      p.settings.URL,
		RoundTripper: roundTripper,
	}

	client, err := api.NewClient(cfg)
	if err != nil {
		return nil, err
	}

	return apiv1.NewAPI(client), nil
}

func (p *Provider) middlewares() []sdkhttpclient.Middleware {
	middlewares := []sdkhttpclient.Middleware{
		middleware.CustomQueryParameters(p.log),
		sdkhttpclient.CustomHeadersMiddleware(),
	}
	if strings.ToLower(p.jsonData.Method) == "get" {
		middlewares = append(middlewares, middleware.ForceHttpGet(p.log))
	}

	return middlewares
}

func reqHeaders(headers map[string]string) map[string]string {
	// copy to avoid changing the original map
	h := make(map[string]string, len(headers))
	for k, v := range headers {
		h[k] = v
	}
	return h
}

func getMap(obj map[string]interface{}, key string) (map[string]interface{}, error) {
	if untypedValue, ok := obj[key]; ok {
		if value, ok := untypedValue.(map[string]interface{}); ok {
			return value, nil
		} else {
			err := fmt.Errorf("the field '%s' should be an object", key)
			return nil, err
		}
	} else {
		err := fmt.Errorf("the field '%s' should be set", key)
		return nil, err
	}
}

func getBool(obj map[string]interface{}, key string) (bool, error) {
	if untypedValue, ok := obj[key]; ok {
		if value, ok := untypedValue.(bool); ok {
			return value, nil
		} else {
			err := fmt.Errorf("the field '%s' should be a bool", key)
			return false, err
		}
	} else {
		err := fmt.Errorf("the field '%s' should be set", key)
		return false, err
	}
}

func getStringOptional(obj map[string]interface{}, key string) (string, error) {
	if untypedValue, ok := obj[key]; ok {
		if value, ok := untypedValue.(string); ok {
			return value, nil
		} else {
			err := fmt.Errorf("the field '%s' should be a string", key)
			return "", err
		}
	} else {
		// Value optional, not error
		return "", nil
	}
}

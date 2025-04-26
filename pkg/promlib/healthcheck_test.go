package promlib

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/assert"
)

type healthCheckProvider[T http.RoundTripper] struct {
	sdkhttpclient.Provider
	RoundTripper *T
}

type healthCheckSuccessRoundTripper struct {
}

type healthCheckFailRoundTripper struct {
}

func (rt *healthCheckSuccessRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return &http.Response{
		Status:     "200",
		StatusCode: 200,
		Header:     nil,
		Body: io.NopCloser(strings.NewReader(`{
			"status": "success",
			"data": {
				"resultType": "scalar",
				"result": [
					1692969348.331,
					"3"
				]
			}
		}`)),
		ContentLength: 0,
		Request:       req,
	}, nil
}

func (rt *healthCheckFailRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return &http.Response{
		Status:        "400",
		StatusCode:    400,
		Header:        nil,
		Body:          nil,
		ContentLength: 0,
		Request:       req,
	}, nil
}

func (provider *healthCheckProvider[T]) New(opts ...sdkhttpclient.Options) (*http.Client, error) {
	client := &http.Client{}
	provider.RoundTripper = new(T)
	client.Transport = *provider.RoundTripper
	return client, nil
}

func (provider *healthCheckProvider[T]) GetTransport(opts ...sdkhttpclient.Options) (http.RoundTripper, error) {
	return *new(T), nil
}

func getMockProvider[T http.RoundTripper]() *sdkhttpclient.Provider {
	p := &healthCheckProvider[T]{
		RoundTripper: new(T),
	}
	anotherFN := func(o sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return *p.RoundTripper
	}
	fn := sdkhttpclient.MiddlewareFunc(anotherFN)
	mid := sdkhttpclient.NamedMiddlewareFunc("mock", fn)
	return sdkhttpclient.NewProvider(sdkhttpclient.ProviderOptions{Middlewares: []sdkhttpclient.Middleware{mid}})
}

func Test_healthcheck(t *testing.T) {
	t.Run("should do a successful health check", func(t *testing.T) {
		httpProvider := getMockProvider[*healthCheckSuccessRoundTripper]()
		logger := backend.NewLoggerWith("logger", "test")
		s := &Service{
			im:     datasource.NewInstanceManager(newInstanceSettings(httpProvider, logger, mockExtendClientOpts)),
			logger: logger,
		}

		req := &backend.CheckHealthRequest{
			PluginContext: getPluginContext(),
			Headers:       nil,
		}

		res, err := s.CheckHealth(context.Background(), req)
		assert.NoError(t, err)
		assert.Equal(t, backend.HealthStatusOk, res.Status)
	})

	t.Run("should return an error for an unsuccessful health check", func(t *testing.T) {
		httpProvider := getMockProvider[*healthCheckFailRoundTripper]()
		logger := backend.NewLoggerWith("logger", "test")
		s := &Service{
			im:     datasource.NewInstanceManager(newInstanceSettings(httpProvider, logger, mockExtendClientOpts)),
			logger: logger,
		}

		req := &backend.CheckHealthRequest{
			PluginContext: getPluginContext(),
			Headers:       nil,
		}

		res, err := s.CheckHealth(context.Background(), req)
		assert.NoError(t, err)
		assert.Equal(t, backend.HealthStatusError, res.Status)
	})
}

func getPluginContext() backend.PluginContext {
	return backend.PluginContext{
		OrgID:                      0,
		PluginID:                   "prometheus",
		User:                       nil,
		AppInstanceSettings:        nil,
		DataSourceInstanceSettings: getPromInstanceSettings(),
		GrafanaConfig:              backend.NewGrafanaCfg(map[string]string{"concurrent_query_count": "10"}),
	}
}

func getPromInstanceSettings() *backend.DataSourceInstanceSettings {
	return &backend.DataSourceInstanceSettings{
		ID:                      0,
		UID:                     "",
		Type:                    "prometheus",
		Name:                    "test-prometheus",
		URL:                     "http://promurl:9090",
		User:                    "",
		Database:                "",
		BasicAuthEnabled:        true,
		BasicAuthUser:           "admin",
		JSONData:                []byte("{}"),
		DecryptedSecureJSONData: map[string]string{},
		Updated:                 time.Time{},
	}
}

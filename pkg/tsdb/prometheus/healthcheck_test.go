package prometheus

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	sdkHttpClient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

type healthCheckProvider[T http.RoundTripper] struct {
	httpclient.Provider
	RoundTripper *T
}

type healthCheckSuccessRoundTripper struct {
}
type healthCheckFailRoundTripper struct {
}

func (rt *healthCheckSuccessRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return &http.Response{
		Status:        "200",
		StatusCode:    200,
		Header:        nil,
		Body:          nil,
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

func (provider *healthCheckProvider[T]) New(opts ...sdkHttpClient.Options) (*http.Client, error) {
	client := &http.Client{}
	provider.RoundTripper = new(T)
	client.Transport = *provider.RoundTripper
	return client, nil
}

func (provider *healthCheckProvider[T]) GetTransport(opts ...sdkHttpClient.Options) (http.RoundTripper, error) {
	return *new(T), nil
}

func getMockProvider[T http.RoundTripper]() *healthCheckProvider[T] {
	return &healthCheckProvider[T]{
		RoundTripper: new(T),
	}
}

func Test_healthcheck(t *testing.T) {
	t.Run("should do a successful health check", func(t *testing.T) {
		httpProvider := getMockProvider[*healthCheckSuccessRoundTripper]()
		s := &Service{
			im: datasource.NewInstanceManager(newInstanceSettings(httpProvider, &setting.Cfg{}, &featuremgmt.FeatureManager{}, nil)),
		}

		req := &backend.CheckHealthRequest{
			PluginContext: getPluginContext(),
			Headers:       nil,
		}

		res, err := s.CheckHealth(context.Background(), req)
		assert.NoError(t, err)
		assert.Equal(t, backend.HealthStatusOk, res.Status)
	})

	// /~/healthy endpoint will return 400 there is no healthcheck support
	// so it will fall back to querying
	t.Run("should fail back to make an instant query", func(t *testing.T) {
		httpProvider := getMockProvider[*healthCheckFailRoundTripper]()
		s := &Service{
			im: datasource.NewInstanceManager(newInstanceSettings(httpProvider, &setting.Cfg{}, &featuremgmt.FeatureManager{}, nil)),
		}

		req := &backend.CheckHealthRequest{
			PluginContext: getPluginContext(),
			Headers:       nil,
		}

		res, err := s.CheckHealth(context.Background(), req)
		assert.NoError(t, err)
		assert.Equal(t, backend.HealthStatusOk, res.Status)
	})
}

func getPluginContext() backend.PluginContext {
	return backend.PluginContext{
		OrgID:                      0,
		PluginID:                   "prometheus",
		User:                       nil,
		AppInstanceSettings:        nil,
		DataSourceInstanceSettings: getPromInstanceSettings(),
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

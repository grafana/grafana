package graphite

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
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
		Body:          io.NopCloser(strings.NewReader(`[{"target": "100.0", "tags": {"name": "100.0"}, "datapoints": [[100.0, 10000], [100.0, 10001], [100.0, 10002]]}]`)),
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

func (provider *healthCheckProvider[T]) New(opts ...httpclient.Options) (*http.Client, error) {
	client := &http.Client{}
	provider.RoundTripper = new(T)
	client.Transport = *provider.RoundTripper
	return client, nil
}

func (provider *healthCheckProvider[T]) GetTransport(opts ...httpclient.Options) (http.RoundTripper, error) {
	return *new(T), nil
}

func getMockProvider[T http.RoundTripper]() *httpclient.Provider {
	p := &healthCheckProvider[T]{
		RoundTripper: new(T),
	}
	rtFunction := func(o httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return *p.RoundTripper
	}
	fn := httpclient.MiddlewareFunc(rtFunction)
	mid := httpclient.NamedMiddlewareFunc("mock", fn)
	return httpclient.NewProvider(httpclient.ProviderOptions{Middlewares: []httpclient.Middleware{mid}})
}

func Test_CheckHealth(t *testing.T) {
	t.Run("should return a successful health check", func(t *testing.T) {
		httpProvider := getMockProvider[*healthCheckSuccessRoundTripper]()
		s := &Service{
			im:     datasource.NewInstanceManager(newInstanceSettings(httpProvider)),
			tracer: tracing.DefaultTracer(),
			logger: backend.NewLoggerWith("logger", "graphite test"),
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
		s := &Service{
			im:     datasource.NewInstanceManager(newInstanceSettings(httpProvider)),
			tracer: tracing.DefaultTracer(),
			logger: backend.NewLoggerWith("logger", "graphite test"),
		}

		req := &backend.CheckHealthRequest{
			PluginContext: getPluginContext(),
			Headers:       nil,
		}

		res, err := s.CheckHealth(context.Background(), req)
		assert.NoError(t, err)
		assert.Equal(t, backend.HealthStatusError, res.Status)
		assert.Equal(t, "Graphite health check failed. See details below", res.Message)
		assert.Equal(t, []byte("{\"verboseMessage\": \"request failed, status: 400\" }"), res.JSONDetails)
	})
}

func getPluginContext() backend.PluginContext {
	return backend.PluginContext{
		OrgID:               0,
		PluginID:            "graphite",
		User:                nil,
		AppInstanceSettings: nil,
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			ID:                      0,
			UID:                     "",
			Type:                    "graphite",
			Name:                    "test-graphite",
			URL:                     "http://graphite",
			User:                    "",
			Database:                "",
			JSONData:                []byte("{}"),
			DecryptedSecureJSONData: map[string]string{},
			Updated:                 time.Time{},
		},
	}
}

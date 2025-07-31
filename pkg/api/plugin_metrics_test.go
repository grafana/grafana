package api

import (
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestPluginMetricsEndpoint(t *testing.T) {
	t.Run("Endpoint is enabled, basic auth disabled", func(t *testing.T) {
		hs := &HTTPServer{
			Cfg: setting.ProvideService(&setting.Cfg{
				MetricsEndpointEnabled:           true,
				MetricsEndpointBasicAuthUsername: "",
				MetricsEndpointBasicAuthPassword: "",
			}),
			pluginClient: &fakePluginClientMetrics{
				store: map[string][]byte{
					"test-plugin": []byte("http_errors=2"),
				},
			},
		}

		s := webtest.NewServer(t, routing.NewRouteRegister())
		s.Mux.Use(hs.pluginMetricsEndpoint)

		t.Run("Endpoint matches and plugin is registered", func(t *testing.T) {
			req := s.NewGetRequest("/metrics/plugins/test-plugin")
			resp, err := s.Send(req)
			require.NoError(t, err)
			require.NotNil(t, resp)

			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, "http_errors=2", string(body))
			require.NoError(t, resp.Body.Close())
			require.Equal(t, http.StatusOK, resp.StatusCode)
			require.Equal(t, "text/plain", resp.Header.Get("Content-Type"))
		})

		t.Run("Endpoint matches and plugin is not registered", func(t *testing.T) {
			req := s.NewGetRequest("/metrics/plugins/plugin-not-registered")
			resp, err := s.Send(req)
			require.NoError(t, err)
			require.NotNil(t, resp)

			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Empty(t, string(body))
			require.NoError(t, resp.Body.Close())
			require.Equal(t, http.StatusNotFound, resp.StatusCode)
		})

		t.Run("Endpoint does not match", func(t *testing.T) {
			req := s.NewGetRequest("/foo")
			resp, err := s.Send(req)
			require.NoError(t, err)
			require.NotNil(t, resp)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, http.StatusNotFound, resp.StatusCode)
		})
	})

	t.Run("Endpoint and basic auth is enabled", func(t *testing.T) {
		hs := &HTTPServer{
			Cfg: setting.ProvideService(&setting.Cfg{
				MetricsEndpointEnabled:           true,
				MetricsEndpointBasicAuthUsername: "user",
				MetricsEndpointBasicAuthPassword: "pwd",
			}),
			pluginClient: &fakePluginClientMetrics{
				store: map[string][]byte{
					"test-plugin": []byte("http_errors=2"),
				},
			},
		}

		s := webtest.NewServer(t, routing.NewRouteRegister())
		s.Mux.Use(hs.pluginMetricsEndpoint)

		t.Run("When plugin is registered, wrong basic auth credentials should return 401", func(t *testing.T) {
			req := s.NewGetRequest("/metrics/plugins/test-plugin")
			req.SetBasicAuth("user2", "pwd2")
			resp, err := s.Send(req)
			require.NoError(t, err)
			require.NotNil(t, resp)

			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		})

		t.Run("When plugin is registered, correct basic auth credentials should return 200", func(t *testing.T) {
			req := s.NewGetRequest("/metrics/plugins/test-plugin")
			req.SetBasicAuth("user", "pwd")
			resp, err := s.Send(req)
			require.NoError(t, err)
			require.NotNil(t, resp)

			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, "http_errors=2", string(body))
			require.NoError(t, resp.Body.Close())
			require.Equal(t, http.StatusOK, resp.StatusCode)
			require.Equal(t, "text/plain", resp.Header.Get("Content-Type"))
		})
	})

	t.Run("Endpoint is disabled", func(t *testing.T) {
		hs := &HTTPServer{
			Cfg: setting.ProvideService(&setting.Cfg{
				MetricsEndpointEnabled: false,
			}),
			pluginClient: &fakePluginClientMetrics{
				store: map[string][]byte{
					"test-plugin": []byte("http_errors=2"),
				},
			},
		}

		s := webtest.NewServer(t, routing.NewRouteRegister())
		s.Mux.Use(hs.pluginMetricsEndpoint)

		t.Run("When plugin is registered, should return 404", func(t *testing.T) {
			req := s.NewGetRequest("/metrics/plugins/test-plugin")
			resp, err := s.Send(req)
			require.NoError(t, err)
			require.NotNil(t, resp)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, http.StatusNotFound, resp.StatusCode)
		})
	})
}

type fakePluginClientMetrics struct {
	plugins.Client

	store map[string][]byte
}

func (c *fakePluginClientMetrics) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	metrics, exists := c.store[req.PluginContext.PluginID]

	if !exists {
		return nil, plugins.ErrPluginNotRegistered
	}

	return &backend.CollectMetricsResult{
		PrometheusMetrics: metrics,
	}, nil
}

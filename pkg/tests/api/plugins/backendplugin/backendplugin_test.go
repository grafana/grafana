package backendplugin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
)

func TestIntegrationBackendPlugins(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		// EnableLog:        true,
	})

	grafanaListeningAddr, testEnv := testinfra.StartGrafanaEnv(t, dir, path)
	ctx := context.Background()

	testinfra.CreateUser(t, testEnv.SQLStore, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	var outgoingRequest *http.Request
	outgoingServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		outgoingRequest = r
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(outgoingServer.Close)

	const testPluginID = "test-plugin"

	testPlugin, backendTestPlugin := createTestPlugin(testPluginID)
	err := testEnv.PluginRegistry.Add(ctx, testPlugin)
	require.NoError(t, err)

	jsonData := simplejson.NewFromAny(map[string]interface{}{
		"httpHeaderName1": "X-CUSTOM-HEADER",
		"oauthPassThru":   true,
		"keepCookies":     []string{"cookie1", "cookie3", "grafana_session"},
	})
	secureJSONData := map[string]string{
		"basicAuthPassword": "basicAuthPassword",
		"httpHeaderValue1":  "custom-header-value",
	}

	uid := "test-plugin"
	err = testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx, &datasources.AddDataSourceCommand{
		OrgId:          1,
		Access:         datasources.DS_ACCESS_PROXY,
		Name:           "TestPlugin",
		Type:           testPluginID,
		Uid:            uid,
		Url:            outgoingServer.URL,
		BasicAuth:      true,
		BasicAuthUser:  "basicAuthUser",
		JsonData:       jsonData,
		SecureJsonData: secureJSONData,
	})
	require.NoError(t, err)

	getDataSourceQuery := &datasources.GetDataSourceQuery{
		OrgId: 1,
		Uid:   uid,
	}
	err = testEnv.Server.HTTPServer.DataSourcesService.GetDataSource(ctx, getDataSourceQuery)
	require.NoError(t, err)

	rt, err := testEnv.Server.HTTPServer.DataSourcesService.GetHTTPTransport(ctx, getDataSourceQuery.Result, testEnv.HTTPClientProvider)
	require.NoError(t, err)

	t.Run("When calling /api/ds/query should set expected headers on outgoing QueryData and HTTP request", func(t *testing.T) {
		var received *struct {
			ctx context.Context
			req *backend.QueryDataRequest
		}
		backendTestPlugin.QueryDataHandler = backend.QueryDataHandlerFunc(func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			received = &struct {
				ctx context.Context
				req *backend.QueryDataRequest
			}{ctx, req}

			c := http.Client{
				Transport: rt,
			}
			outReq, err := http.NewRequestWithContext(ctx, http.MethodGet, outgoingServer.URL, nil)
			require.NoError(t, err)
			resp, err := c.Do(outReq)
			if err != nil {
				return nil, err
			}
			defer func() {
				if err := resp.Body.Close(); err != nil {
					testEnv.Server.HTTPServer.Cfg.Logger.Error("Failed to close body", "error", err)
				}
			}()

			_, err = io.Copy(io.Discard, resp.Body)
			if err != nil {
				testEnv.Server.HTTPServer.Cfg.Logger.Error("Failed to discard body", "error", err)
			}

			return &backend.QueryDataResponse{}, nil
		})

		query := simplejson.NewFromAny(map[string]interface{}{
			"datasource": map[string]interface{}{
				"uid": uid,
			},
		})
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dtos.MetricRequest{
			From:    "now-1h",
			To:      "now",
			Queries: []*simplejson.Json{query},
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/ds/query", grafanaListeningAddr)

		req, err := http.NewRequest(http.MethodPost, u, buf1)
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{
			Name: "cookie1",
		})
		req.AddCookie(&http.Cookie{
			Name: "cookie2",
		})
		req.AddCookie(&http.Cookie{
			Name: "cookie3",
		})
		req.AddCookie(&http.Cookie{
			Name: "grafana_session",
		})

		require.NoError(t, err)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode, string(b))
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		_, err = io.ReadAll(resp.Body)
		require.NoError(t, err)

		// backend query data request
		require.NotNil(t, received)
		require.Equal(t, "cookie1=; cookie3=", received.req.Headers["Cookie"])

		// outgoing HTTP request
		require.NotNil(t, outgoingRequest)
		require.Equal(t, "cookie1=; cookie3=", outgoingRequest.Header.Get("Cookie"))
		require.Equal(t, "custom-header-value", outgoingRequest.Header.Get("X-CUSTOM-HEADER"))
		username, pwd, ok := outgoingRequest.BasicAuth()
		require.True(t, ok)
		require.Equal(t, "basicAuthUser", username)
		require.Equal(t, "basicAuthPassword", pwd)
	})

	t.Run("When calling /api/datasources/uid/:uid/health should set expected headers on outgoing CheckHealth and HTTP request", func(t *testing.T) {
		var received *struct {
			ctx context.Context
			req *backend.CheckHealthRequest
		}
		backendTestPlugin.CheckHealthHandler = backend.CheckHealthHandlerFunc(func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
			received = &struct {
				ctx context.Context
				req *backend.CheckHealthRequest
			}{ctx, req}

			c := http.Client{
				Transport: rt,
			}
			outReq, err := http.NewRequestWithContext(ctx, http.MethodGet, outgoingServer.URL, nil)
			require.NoError(t, err)
			resp, err := c.Do(outReq)
			if err != nil {
				return nil, err
			}
			defer func() {
				if err := resp.Body.Close(); err != nil {
					testEnv.Server.HTTPServer.Cfg.Logger.Error("Failed to close body", "error", err)
				}
			}()

			_, err = io.Copy(io.Discard, resp.Body)
			if err != nil {
				testEnv.Server.HTTPServer.Cfg.Logger.Error("Failed to discard body", "error", err)
			}

			return &backend.CheckHealthResult{
				Status: backend.HealthStatusOk,
			}, nil
		})

		u := fmt.Sprintf("http://admin:admin@%s/api/datasources/uid/%s/health", grafanaListeningAddr, uid)

		req, err := http.NewRequest(http.MethodGet, u, nil)
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{
			Name: "cookie1",
		})
		req.AddCookie(&http.Cookie{
			Name: "cookie2",
		})
		req.AddCookie(&http.Cookie{
			Name: "cookie3",
		})
		req.AddCookie(&http.Cookie{
			Name: "grafana_session",
		})

		require.NoError(t, err)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode, string(b))
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		_, err = io.ReadAll(resp.Body)
		require.NoError(t, err)

		// backend query data request
		require.NotNil(t, received)
		require.Equal(t, "cookie1=; cookie3=", received.req.Headers["Cookie"])

		// outgoing HTTP request
		require.NotNil(t, outgoingRequest)
		require.Equal(t, "cookie1=; cookie3=", outgoingRequest.Header.Get("Cookie"))
		require.Equal(t, "custom-header-value", outgoingRequest.Header.Get("X-CUSTOM-HEADER"))
		username, pwd, ok := outgoingRequest.BasicAuth()
		require.True(t, ok)
		require.Equal(t, "basicAuthUser", username)
		require.Equal(t, "basicAuthPassword", pwd)
	})

	t.Run("When calling /api/datasources/uid/:uid/resources should set expected headers on outgoing CallResource and HTTP request", func(t *testing.T) {
		var received *struct {
			ctx context.Context
			req *backend.CallResourceRequest
		}
		backendTestPlugin.CallResourceHandler = backend.CallResourceHandlerFunc(func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			received = &struct {
				ctx context.Context
				req *backend.CallResourceRequest
			}{ctx, req}

			c := http.Client{
				Transport: rt,
			}
			outReq, err := http.NewRequestWithContext(ctx, http.MethodGet, outgoingServer.URL, nil)
			require.NoError(t, err)
			resp, err := c.Do(outReq)
			if err != nil {
				return err
			}
			defer func() {
				if err := resp.Body.Close(); err != nil {
					testEnv.Server.HTTPServer.Cfg.Logger.Error("Failed to close body", "error", err)
				}
			}()

			_, err = io.Copy(io.Discard, resp.Body)
			if err != nil {
				testEnv.Server.HTTPServer.Cfg.Logger.Error("Failed to discard body", "error", err)
			}

			err = sender.Send(&backend.CallResourceResponse{
				Status: http.StatusOK,
			})

			return err
		})

		u := fmt.Sprintf("http://admin:admin@%s/api/datasources/uid/%s/resources", grafanaListeningAddr, uid)

		req, err := http.NewRequest(http.MethodGet, u, nil)
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{
			Name: "cookie1",
		})
		req.AddCookie(&http.Cookie{
			Name: "cookie2",
		})
		req.AddCookie(&http.Cookie{
			Name: "cookie3",
		})
		req.AddCookie(&http.Cookie{
			Name: "grafana_session",
		})

		require.NoError(t, err)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode, string(b))
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		_, err = io.ReadAll(resp.Body)
		require.NoError(t, err)

		// backend query data request
		require.NotNil(t, received)
		require.Equal(t, "cookie1=; cookie3=", received.req.Headers["Cookie"][0])

		// outgoing HTTP request
		require.NotNil(t, outgoingRequest)
		require.Equal(t, "cookie1=; cookie3=", outgoingRequest.Header.Get("Cookie"))
		require.Equal(t, "custom-header-value", outgoingRequest.Header.Get("X-CUSTOM-HEADER"))
		username, pwd, ok := outgoingRequest.BasicAuth()
		require.True(t, ok)
		require.Equal(t, "basicAuthUser", username)
		require.Equal(t, "basicAuthPassword", pwd)
	})
}

func createTestPlugin(id string) (*plugins.Plugin, *testPlugin) {
	p := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID: id,
		},
		Class: plugins.Core,
	}

	p.SetLogger(log.New("test-plugin"))
	tp := &testPlugin{
		pluginID: id,
		logger:   p.Logger(),
		QueryDataHandler: backend.QueryDataHandlerFunc(func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			return &backend.QueryDataResponse{}, nil
		}),
	}
	p.RegisterClient(tp)

	return p, tp
}

type testPlugin struct {
	pluginID string
	logger   log.Logger
	backend.CheckHealthHandler
	backend.CallResourceHandler
	backend.QueryDataHandler
	backend.StreamHandler
}

func (tp *testPlugin) PluginID() string {
	return tp.pluginID
}

func (tp *testPlugin) Logger() log.Logger {
	return tp.logger
}

func (tp *testPlugin) Start(ctx context.Context) error {
	return nil
}

func (tp *testPlugin) Stop(ctx context.Context) error {
	return nil
}

func (tp *testPlugin) IsManaged() bool {
	return true
}

func (tp *testPlugin) Exited() bool {
	return false
}

func (tp *testPlugin) Decommission() error {
	return nil
}

func (tp *testPlugin) IsDecommissioned() bool {
	return false
}

func (tp *testPlugin) CollectMetrics(_ context.Context, _ *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *testPlugin) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if tp.CheckHealthHandler != nil {
		return tp.CheckHealthHandler.CheckHealth(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *testPlugin) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if tp.QueryDataHandler != nil {
		return tp.QueryDataHandler.QueryData(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *testPlugin) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if tp.CallResourceHandler != nil {
		return tp.CallResourceHandler.CallResource(ctx, req, sender)
	}

	return backendplugin.ErrMethodNotImplemented
}

func (tp *testPlugin) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if tp.StreamHandler != nil {
		return tp.StreamHandler.SubscribeStream(ctx, req)
	}
	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *testPlugin) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if tp.StreamHandler != nil {
		return tp.StreamHandler.PublishStream(ctx, req)
	}
	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *testPlugin) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if tp.StreamHandler != nil {
		return tp.StreamHandler.RunStream(ctx, req, sender)
	}
	return backendplugin.ErrMethodNotImplemented
}

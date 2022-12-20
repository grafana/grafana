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
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
)

func TestIntegrationBackendPlugins(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	regularQuery := func(t *testing.T, tsCtx *testScenarioContext) dtos.MetricRequest {
		t.Helper()

		return metricRequestWithQueries(t, fmt.Sprintf(`{
			"datasource": {
				"uid": "%s"
			}
		}`, tsCtx.uid))
	}

	expressionQuery := func(t *testing.T, tsCtx *testScenarioContext) dtos.MetricRequest {
		t.Helper()

		return metricRequestWithQueries(t, fmt.Sprintf(`{
			"refId": "A",
			"datasource": {
				"uid": "%s",
				"type": "%s"
			}
		}`, tsCtx.uid, tsCtx.testPluginID), `{
			"refId": "B",
			"datasource": {
				"type": "__expr__",
				"uid": "__expr__",
				"name": "Expression"
			},
			"type": "math",
			"expression": "$A - 50"
		}`)
	}

	newTestScenario(t, "When oauth token not available", func(t *testing.T, tsCtx *testScenarioContext) {
		tsCtx.testEnv.OAuthTokenService.Token = nil

		tsCtx.runCheckHealthTest(t)
		tsCtx.runCallResourceTest(t)

		t.Run("regular query", func(t *testing.T) {
			tsCtx.runQueryDataTest(t, regularQuery(t, tsCtx))
		})

		t.Run("expression query", func(t *testing.T) {
			tsCtx.runQueryDataTest(t, expressionQuery(t, tsCtx))
		})
	})

	newTestScenario(t, "When oauth token available", func(t *testing.T, tsCtx *testScenarioContext) {
		token := &oauth2.Token{
			TokenType:    "bearer",
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
			Expiry:       time.Now().UTC().Add(24 * time.Hour),
		}
		token = token.WithExtra(map[string]interface{}{"id_token": "id-token"})
		tsCtx.testEnv.OAuthTokenService.Token = token

		tsCtx.runCheckHealthTest(t)
		tsCtx.runCallResourceTest(t)

		t.Run("regular query", func(t *testing.T) {
			tsCtx.runQueryDataTest(t, regularQuery(t, tsCtx))
		})

		t.Run("expression query", func(t *testing.T) {
			tsCtx.runQueryDataTest(t, expressionQuery(t, tsCtx))
		})
	})
}

type testScenarioContext struct {
	testPluginID         string
	uid                  string
	grafanaListeningAddr string
	testEnv              *server.TestEnv
	outgoingServer       *httptest.Server
	outgoingRequest      *http.Request
	backendTestPlugin    *testPlugin
	rt                   http.RoundTripper
}

func newTestScenario(t *testing.T, name string, callback func(t *testing.T, ctx *testScenarioContext)) {
	tsCtx := testScenarioContext{
		testPluginID: "test-plugin",
	}

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		// EnableLog:        true,
	})

	grafanaListeningAddr, testEnv := testinfra.StartGrafanaEnv(t, dir, path)
	tsCtx.grafanaListeningAddr = grafanaListeningAddr
	tsCtx.testEnv = testEnv
	ctx := context.Background()

	testinfra.CreateUser(t, testEnv.SQLStore, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	tsCtx.outgoingServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tsCtx.outgoingRequest = r
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(tsCtx.outgoingServer.Close)

	testPlugin, backendTestPlugin := createTestPlugin(tsCtx.testPluginID)
	tsCtx.backendTestPlugin = backendTestPlugin
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

	tsCtx.uid = "test-plugin"
	err = testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx, &datasources.AddDataSourceCommand{
		OrgId:          1,
		Access:         datasources.DS_ACCESS_PROXY,
		Name:           "TestPlugin",
		Type:           tsCtx.testPluginID,
		Uid:            tsCtx.uid,
		Url:            tsCtx.outgoingServer.URL,
		BasicAuth:      true,
		BasicAuthUser:  "basicAuthUser",
		JsonData:       jsonData,
		SecureJsonData: secureJSONData,
	})
	require.NoError(t, err)

	getDataSourceQuery := &datasources.GetDataSourceQuery{
		OrgId: 1,
		Uid:   tsCtx.uid,
	}
	err = testEnv.Server.HTTPServer.DataSourcesService.GetDataSource(ctx, getDataSourceQuery)
	require.NoError(t, err)

	rt, err := testEnv.Server.HTTPServer.DataSourcesService.GetHTTPTransport(ctx, getDataSourceQuery.Result, testEnv.HTTPClientProvider)
	require.NoError(t, err)

	tsCtx.rt = rt

	t.Run(name, func(t *testing.T) {
		callback(t, &tsCtx)
	})
}

func (tsCtx *testScenarioContext) runQueryDataTest(t *testing.T, mr dtos.MetricRequest) {
	t.Run("When calling /api/ds/query should set expected headers on outgoing QueryData and HTTP request", func(t *testing.T) {
		var received *struct {
			ctx context.Context
			req *backend.QueryDataRequest
		}
		tsCtx.backendTestPlugin.QueryDataHandler = backend.QueryDataHandlerFunc(func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			received = &struct {
				ctx context.Context
				req *backend.QueryDataRequest
			}{ctx, req}

			c := http.Client{
				Transport: tsCtx.rt,
			}
			outReq, err := http.NewRequestWithContext(ctx, http.MethodGet, tsCtx.outgoingServer.URL, nil)
			require.NoError(t, err)
			resp, err := c.Do(outReq)
			if err != nil {
				return nil, err
			}
			defer func() {
				if err := resp.Body.Close(); err != nil {
					tsCtx.testEnv.Server.HTTPServer.Cfg.Logger.Error("Failed to close body", "error", err)
				}
			}()

			_, err = io.Copy(io.Discard, resp.Body)
			if err != nil {
				tsCtx.testEnv.Server.HTTPServer.Cfg.Logger.Error("Failed to discard body", "error", err)
			}

			return &backend.QueryDataResponse{}, nil
		})

		buf1 := &bytes.Buffer{}
		err := json.NewEncoder(buf1).Encode(mr)
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/ds/query", tsCtx.grafanaListeningAddr)

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

		token := tsCtx.testEnv.OAuthTokenService.Token

		var expectedAuthHeader string
		var expectedTokenHeader string

		if token != nil {
			expectedAuthHeader = fmt.Sprintf("Bearer %s", token.AccessToken)
			expectedTokenHeader = token.Extra("id_token").(string)

			require.Equal(t, expectedAuthHeader, received.req.Headers["Authorization"])
			require.Equal(t, expectedTokenHeader, received.req.Headers["X-ID-Token"])
		}

		// outgoing HTTP request
		require.NotNil(t, tsCtx.outgoingRequest)
		require.Equal(t, "cookie1=; cookie3=", tsCtx.outgoingRequest.Header.Get("Cookie"))
		require.Equal(t, "custom-header-value", tsCtx.outgoingRequest.Header.Get("X-CUSTOM-HEADER"))

		if token == nil {
			username, pwd, ok := tsCtx.outgoingRequest.BasicAuth()
			require.True(t, ok)
			require.Equal(t, "basicAuthUser", username)
			require.Equal(t, "basicAuthPassword", pwd)
		} else {
			require.Equal(t, expectedAuthHeader, tsCtx.outgoingRequest.Header.Get("Authorization"))
			require.Equal(t, expectedTokenHeader, tsCtx.outgoingRequest.Header.Get("X-ID-Token"))
		}
	})
}

func (tsCtx *testScenarioContext) runCheckHealthTest(t *testing.T) {
	t.Run("When calling /api/datasources/uid/:uid/health should set expected headers on outgoing CheckHealth and HTTP request", func(t *testing.T) {
		var received *struct {
			ctx context.Context
			req *backend.CheckHealthRequest
		}
		tsCtx.backendTestPlugin.CheckHealthHandler = backend.CheckHealthHandlerFunc(func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
			received = &struct {
				ctx context.Context
				req *backend.CheckHealthRequest
			}{ctx, req}

			c := http.Client{
				Transport: tsCtx.rt,
			}
			outReq, err := http.NewRequestWithContext(ctx, http.MethodGet, tsCtx.outgoingServer.URL, nil)
			require.NoError(t, err)
			resp, err := c.Do(outReq)
			if err != nil {
				return nil, err
			}
			defer func() {
				if err := resp.Body.Close(); err != nil {
					tsCtx.testEnv.Server.HTTPServer.Cfg.Logger.Error("Failed to close body", "error", err)
				}
			}()

			_, err = io.Copy(io.Discard, resp.Body)
			if err != nil {
				tsCtx.testEnv.Server.HTTPServer.Cfg.Logger.Error("Failed to discard body", "error", err)
			}

			return &backend.CheckHealthResult{
				Status: backend.HealthStatusOk,
			}, nil
		})

		u := fmt.Sprintf("http://admin:admin@%s/api/datasources/uid/%s/health", tsCtx.grafanaListeningAddr, tsCtx.uid)

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

		token := tsCtx.testEnv.OAuthTokenService.Token

		var expectedAuthHeader string
		var expectedTokenHeader string

		if token != nil {
			expectedAuthHeader = fmt.Sprintf("Bearer %s", token.AccessToken)
			expectedTokenHeader = token.Extra("id_token").(string)

			require.Equal(t, expectedAuthHeader, received.req.Headers["Authorization"])
			require.Equal(t, expectedTokenHeader, received.req.Headers["X-ID-Token"])
		}

		// outgoing HTTP request
		require.NotNil(t, tsCtx.outgoingRequest)
		require.Equal(t, "cookie1=; cookie3=", tsCtx.outgoingRequest.Header.Get("Cookie"))
		require.Equal(t, "custom-header-value", tsCtx.outgoingRequest.Header.Get("X-CUSTOM-HEADER"))

		if token == nil {
			username, pwd, ok := tsCtx.outgoingRequest.BasicAuth()
			require.True(t, ok)
			require.Equal(t, "basicAuthUser", username)
			require.Equal(t, "basicAuthPassword", pwd)
		} else {
			require.Equal(t, expectedAuthHeader, tsCtx.outgoingRequest.Header.Get("Authorization"))
			require.Equal(t, expectedTokenHeader, tsCtx.outgoingRequest.Header.Get("X-ID-Token"))
		}
	})
}

func (tsCtx *testScenarioContext) runCallResourceTest(t *testing.T) {
	t.Run("When calling /api/datasources/uid/:uid/resources should set expected headers on outgoing CallResource and HTTP request", func(t *testing.T) {
		var received *struct {
			ctx context.Context
			req *backend.CallResourceRequest
		}
		tsCtx.backendTestPlugin.CallResourceHandler = backend.CallResourceHandlerFunc(func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			received = &struct {
				ctx context.Context
				req *backend.CallResourceRequest
			}{ctx, req}

			c := http.Client{
				Transport: tsCtx.rt,
			}
			outReq, err := http.NewRequestWithContext(ctx, http.MethodGet, tsCtx.outgoingServer.URL, nil)
			require.NoError(t, err)
			for k, vals := range req.Headers {
				for _, v := range vals {
					outReq.Header.Add(k, v)
				}
			}

			resp, err := c.Do(outReq)
			if err != nil {
				return err
			}
			defer func() {
				if err := resp.Body.Close(); err != nil {
					tsCtx.testEnv.Server.HTTPServer.Cfg.Logger.Error("Failed to close body", "error", err)
				}
			}()

			_, err = io.Copy(io.Discard, resp.Body)
			if err != nil {
				tsCtx.testEnv.Server.HTTPServer.Cfg.Logger.Error("Failed to discard body", "error", err)
			}

			responseHeaders := map[string][]string{
				"Connection":       {"close, TE"},
				"Te":               {"foo", "bar, trailers"},
				"Proxy-Connection": {"should be deleted"},
				"Upgrade":          {"foo"},
				"Set-Cookie":       {"should be deleted"},
				"X-Custom":         {"should not be deleted"},
			}

			err = sender.Send(&backend.CallResourceResponse{
				Status:  http.StatusOK,
				Headers: responseHeaders,
			})

			return err
		})

		u := fmt.Sprintf("http://admin:admin@%s/api/datasources/uid/%s/resources", tsCtx.grafanaListeningAddr, tsCtx.uid)

		req, err := http.NewRequest(http.MethodGet, u, nil)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Connection", "X-Some-Conn-Header")
		req.Header.Set("X-Some-Conn-Header", "should be deleted")
		req.Header.Set("Proxy-Connection", "should be deleted")
		req.Header.Set("X-Custom", "custom")
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

		require.Empty(t, resp.Header.Get("Connection"))
		require.Empty(t, resp.Header.Get("Te"))
		require.Empty(t, resp.Header.Get("Proxy-Connection"))
		require.Empty(t, resp.Header.Get("Upgrade"))
		require.Empty(t, resp.Header.Get("Set-Cookie"))
		require.Equal(t, "should not be deleted", resp.Header.Get("X-Custom"))

		// backend query data request
		require.NotNil(t, received)
		require.Equal(t, "cookie1=; cookie3=", received.req.Headers["Cookie"][0])
		require.Empty(t, received.req.Headers["Connection"])
		require.Empty(t, received.req.Headers["X-Some-Conn-Header"])
		require.Empty(t, received.req.Headers["Proxy-Connection"])
		require.Equal(t, "custom", received.req.Headers["X-Custom"][0])

		token := tsCtx.testEnv.OAuthTokenService.Token

		var expectedAuthHeader string
		var expectedTokenHeader string

		if token != nil {
			expectedAuthHeader = fmt.Sprintf("Bearer %s", token.AccessToken)
			expectedTokenHeader = token.Extra("id_token").(string)

			require.Equal(t, expectedAuthHeader, received.req.Headers["Authorization"][0])
			require.Equal(t, expectedTokenHeader, received.req.Headers["X-ID-Token"][0])
		}

		// outgoing HTTP request
		require.NotNil(t, tsCtx.outgoingRequest)
		require.Equal(t, "cookie1=; cookie3=", tsCtx.outgoingRequest.Header.Get("Cookie"))
		require.Empty(t, tsCtx.outgoingRequest.Header.Get("Connection"))
		require.Empty(t, tsCtx.outgoingRequest.Header.Get("X-Some-Conn-Header"))
		require.Empty(t, tsCtx.outgoingRequest.Header.Get("Proxy-Connection"))
		require.Equal(t, "custom", tsCtx.outgoingRequest.Header.Get("X-Custom"))
		require.Equal(t, "custom-header-value", tsCtx.outgoingRequest.Header.Get("X-CUSTOM-HEADER"))

		if token == nil {
			username, pwd, ok := tsCtx.outgoingRequest.BasicAuth()
			require.True(t, ok)
			require.Equal(t, "basicAuthUser", username)
			require.Equal(t, "basicAuthPassword", pwd)
		} else {
			require.Equal(t, expectedAuthHeader, tsCtx.outgoingRequest.Header.Get("Authorization"))
			require.Equal(t, expectedTokenHeader, tsCtx.outgoingRequest.Header.Get("X-ID-Token"))
		}
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

func metricRequestWithQueries(t *testing.T, rawQueries ...string) dtos.MetricRequest {
	t.Helper()
	queries := make([]*simplejson.Json, 0)
	for _, q := range rawQueries {
		json, err := simplejson.NewJson([]byte(q))
		require.NoError(t, err)
		queries = append(queries, json)
	}
	return dtos.MetricRequest{
		From:    "now-1h",
		To:      "now",
		Queries: queries,
		Debug:   false,
	}
}

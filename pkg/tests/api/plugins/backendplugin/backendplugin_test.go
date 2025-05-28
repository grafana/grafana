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
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

const loginCookieName = "grafana_session"

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationBackendPlugins(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	oauthToken := &oauth2.Token{
		TokenType:    "bearer",
		AccessToken:  "access-token",
		RefreshToken: "refresh-token",
		Expiry:       time.Now().UTC().Add(24 * time.Hour),
	}
	oauthToken = oauthToken.WithExtra(map[string]any{"id_token": "id-token"})

	newTestScenario(t, "Datasource with no custom HTTP settings",
		options(
			withIncomingRequest(func(req *http.Request) {
				req.Header.Set("X-Custom", "custom")
				req.AddCookie(&http.Cookie{Name: "cookie1"})
				req.AddCookie(&http.Cookie{Name: "cookie2"})
				req.AddCookie(&http.Cookie{Name: "cookie3"})
				req.AddCookie(&http.Cookie{Name: loginCookieName})
			}),
		),
		func(t *testing.T, tsCtx *testScenarioContext) {
			verify := func(h backend.ForwardHTTPHeaders) {
				require.NotNil(t, h)
				require.Empty(t, h.GetHTTPHeader(backend.CookiesHeaderName))
				require.Empty(t, h.GetHTTPHeader("Authorization"))

				require.NotNil(t, tsCtx.outgoingRequest)
				require.NotEmpty(t, tsCtx.outgoingRequest.Header)
			}

			tsCtx.runCheckHealthTest(t, func(pReq *backend.CheckHealthRequest) {
				verify(pReq)
			})

			tsCtx.runCallResourceTest(t, func(pReq *backend.CallResourceRequest, resp *http.Response) {
				verify(pReq)
				require.Equal(t, "custom", pReq.GetHTTPHeader("X-Custom"))
				require.Equal(t, "custom", tsCtx.outgoingRequest.Header.Get("X-Custom"))
				require.Equal(t, "should not be deleted", resp.Header.Get("X-Custom"))
				require.Equal(t, http.StatusOK, resp.StatusCode)

				// default content type set if not provided
				require.Equal(t, "application/json", resp.Header.Get("Content-Type"))
			})

			verifyQueryData := func(pReq *backend.QueryDataRequest) {
				verify(pReq)
			}

			t.Run("regular query", func(t *testing.T) {
				tsCtx.runQueryDataTest(t, createRegularQuery(t, tsCtx), verifyQueryData)

				t.Run("expression query", func(t *testing.T) {
					tsCtx.runQueryDataTest(t, createExpressionQuery(t, tsCtx), verifyQueryData)
				})
			})
		})

	newTestScenario(t, "Datasource with most HTTP settings set except oauthPassThru and oauth token available",
		options(
			withIncomingRequest(func(req *http.Request) {
				req.AddCookie(&http.Cookie{Name: "cookie1"})
				req.AddCookie(&http.Cookie{Name: "cookie2"})
				req.AddCookie(&http.Cookie{Name: "cookie3"})
				req.AddCookie(&http.Cookie{Name: loginCookieName})
			}),
			withOAuthToken(oauthToken),
			withDsBasicAuth("basicAuthUser", "basicAuthPassword"),
			withDsCustomHeader(map[string]string{"X-CUSTOM-HEADER": "custom-header-value"}),
			withDsCookieForwarding([]string{"cookie1", "cookie3", loginCookieName}),
		),
		func(t *testing.T, tsCtx *testScenarioContext) {
			verify := func(h backend.ForwardHTTPHeaders) {
				require.NotNil(t, h)
				require.Equal(t, "cookie1=; cookie3=", h.GetHTTPHeader(backend.CookiesHeaderName))
				require.Empty(t, h.GetHTTPHeader(backend.OAuthIdentityTokenHeaderName))
				require.Empty(t, h.GetHTTPHeader(backend.OAuthIdentityIDTokenHeaderName))

				require.NotNil(t, tsCtx.outgoingRequest)
				require.Equal(t, "cookie1=; cookie3=", tsCtx.outgoingRequest.Header.Get(backend.CookiesHeaderName))
				require.Equal(t, "custom-header-value", tsCtx.outgoingRequest.Header.Get("X-CUSTOM-HEADER"))

				username, pwd, ok := tsCtx.outgoingRequest.BasicAuth()
				require.True(t, ok)
				require.Equal(t, "basicAuthUser", username)
				require.Equal(t, "basicAuthPassword", pwd)
			}

			tsCtx.runCheckHealthTest(t, func(pReq *backend.CheckHealthRequest) {
				verify(pReq)
			})

			tsCtx.runCallResourceTest(t, func(pReq *backend.CallResourceRequest, resp *http.Response) {
				verify(pReq)

				require.Equal(t, "should not be deleted", resp.Header.Get("X-Custom"))
				require.Equal(t, http.StatusOK, resp.StatusCode)

				// default content type set if not provided
				require.Equal(t, "application/json", resp.Header.Get("Content-Type"))
			})

			verifyQueryData := func(pReq *backend.QueryDataRequest) {
				verify(pReq)
			}

			t.Run("regular query", func(t *testing.T) {
				tsCtx.runQueryDataTest(t, createRegularQuery(t, tsCtx), verifyQueryData)

				t.Run("expression query", func(t *testing.T) {
					tsCtx.runQueryDataTest(t, createExpressionQuery(t, tsCtx), verifyQueryData)
				})
			})
		})

	newTestScenario(t, "Datasource with oauthPassThru and basic auth configured and oauth token available",
		options(
			withOAuthToken(oauthToken),
			withDsOAuthForwarding(),
			withDsBasicAuth("basicAuthUser", "basicAuthPassword"),
		),
		func(t *testing.T, tsCtx *testScenarioContext) {
			verify := func(h backend.ForwardHTTPHeaders) {
				require.NotNil(t, h)

				expectedAuthHeader := fmt.Sprintf("Bearer %s", oauthToken.AccessToken)
				expectedTokenHeader := oauthToken.Extra("id_token").(string)

				require.Equal(t, expectedAuthHeader, h.GetHTTPHeader(backend.OAuthIdentityTokenHeaderName))
				require.Equal(t, expectedTokenHeader, h.GetHTTPHeader(backend.OAuthIdentityIDTokenHeaderName))

				require.NotNil(t, tsCtx.outgoingRequest)
				require.Equal(t, expectedAuthHeader, tsCtx.outgoingRequest.Header.Get(backend.OAuthIdentityTokenHeaderName))
				require.Equal(t, expectedTokenHeader, tsCtx.outgoingRequest.Header.Get(backend.OAuthIdentityIDTokenHeaderName))
			}

			tsCtx.runCheckHealthTest(t, func(pReq *backend.CheckHealthRequest) {
				verify(pReq)
			})

			tsCtx.runCallResourceTest(t, func(pReq *backend.CallResourceRequest, resp *http.Response) {
				verify(pReq)

				require.Equal(t, "should not be deleted", resp.Header.Get("X-Custom"))
				require.Equal(t, http.StatusOK, resp.StatusCode)

				// default content type set if not provided
				require.Equal(t, "application/json", resp.Header.Get("Content-Type"))
			})

			verifyQueryData := func(pReq *backend.QueryDataRequest) {
				verify(pReq)
			}

			t.Run("regular query", func(t *testing.T) {
				tsCtx.runQueryDataTest(t, createRegularQuery(t, tsCtx), verifyQueryData)

				t.Run("expression query", func(t *testing.T) {
					tsCtx.runQueryDataTest(t, createExpressionQuery(t, tsCtx), verifyQueryData)
				})
			})
		})

	newTestScenario(t, "Datasource with resource returning non-default content-type should not be kept",
		options(
			withCallResourceResponse(func(sender backend.CallResourceResponseSender) error {
				return sender.Send(&backend.CallResourceResponse{
					Status: http.StatusOK,
					Headers: map[string][]string{
						"Content-Type":   {"text/plain"},
						"Content-Length": {"5"},
					},
					Body: []byte("hello"),
				})
			}),
		),
		func(t *testing.T, tsCtx *testScenarioContext) {
			tsCtx.runCallResourceTest(t, func(pReq *backend.CallResourceRequest, resp *http.Response) {
				require.Equal(t, "text/plain", resp.Header.Get("Content-Type"))
				require.Equal(t, http.StatusOK, resp.StatusCode)
				require.Equal(t, int64(5), resp.ContentLength)
				require.Empty(t, resp.TransferEncoding)
			})
		})

	newTestScenario(t, "Datasource with resource returning 204 (no content) status should not set content-type header",
		options(
			withCallResourceResponse(func(sender backend.CallResourceResponseSender) error {
				return sender.Send(&backend.CallResourceResponse{
					Status: http.StatusNoContent,
				})
			}),
		),
		func(t *testing.T, tsCtx *testScenarioContext) {
			tsCtx.runCallResourceTest(t, func(pReq *backend.CallResourceRequest, resp *http.Response) {
				require.Empty(t, resp.Header.Get("Content-Type"))
				require.Equal(t, http.StatusNoContent, resp.StatusCode)
			})
		})

	newTestScenario(t, "Datasource with resource returning streaming content should return chunked transfer encoding",
		options(
			withCallResourceResponse(func(sender backend.CallResourceResponseSender) error {
				err := sender.Send(&backend.CallResourceResponse{
					Status: http.StatusOK,
					Headers: map[string][]string{
						"Content-Type": {"text/plain"},
					},
					Body: []byte("msg 1\r\n"),
				})

				if err != nil {
					return err
				}

				return sender.Send(&backend.CallResourceResponse{
					Body: []byte("msg 2\r\n"),
				})
			}),
		),
		func(t *testing.T, tsCtx *testScenarioContext) {
			tsCtx.runCallResourceTest(t, func(pReq *backend.CallResourceRequest, resp *http.Response) {
				require.Equal(t, "text/plain", resp.Header.Get("Content-Type"))
				require.Equal(t, http.StatusOK, resp.StatusCode)
				require.Equal(t, []string{"chunked"}, resp.TransferEncoding)
				bytes, err := io.ReadAll(resp.Body)
				require.NoError(t, err)
				require.Equal(t, "msg 1\r\nmsg 2\r\n", string(bytes))
			})
		})

	newTestScenario(t, "Query data error should return expected status code and marked with downstream status",
		options(),
		func(t *testing.T, tsCtx *testScenarioContext) {
			tsCtx.backendTestPlugin.QueryDataHandler = backend.QueryDataHandlerFunc(func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				return nil, fmt.Errorf("BOOM")
			})

			req := createQueryDataHTTPRequest(t, tsCtx, createRegularQuery(t, tsCtx))
			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.Equal(t, http.StatusInternalServerError, resp.StatusCode)
			require.NotNil(t, tsCtx.incomingRequest)
			require.Equal(t, "/api/ds/query", tsCtx.incomingRequest.URL.Path)
			rmd := requestmeta.GetRequestMetaData(tsCtx.incomingRequest.Context())
			require.Equal(t, requestmeta.StatusSourceDownstream, rmd.StatusSource)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
		})

	newTestScenario(t, "Call resource error should return expected status code and marked with downstream status",
		options(),
		func(t *testing.T, tsCtx *testScenarioContext) {
			tsCtx.backendTestPlugin.CallResourceHandler = backend.CallResourceHandlerFunc(func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				return fmt.Errorf("BOOM")
			})

			req := createCallResourceHTTPRequest(t, tsCtx)
			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.Equal(t, http.StatusInternalServerError, resp.StatusCode)
			require.NotNil(t, tsCtx.incomingRequest)
			require.Equal(t, "/api/datasources/uid/test-plugin/resources", tsCtx.incomingRequest.URL.Path)
			rmd := requestmeta.GetRequestMetaData(tsCtx.incomingRequest.Context())
			require.Equal(t, requestmeta.StatusSourceDownstream, rmd.StatusSource)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
		})

	newTestScenario(t, "Check health error should return expected status code and marked with downstream status",
		options(),
		func(t *testing.T, tsCtx *testScenarioContext) {
			tsCtx.backendTestPlugin.CheckHealthHandler = backend.CheckHealthHandlerFunc(func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
				return nil, fmt.Errorf("BOOM")
			})

			req := createCheckHealthHTTPRequest(t, tsCtx)
			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.Equal(t, http.StatusInternalServerError, resp.StatusCode)
			require.NotNil(t, tsCtx.incomingRequest)
			require.Equal(t, "/api/datasources/uid/test-plugin/health", tsCtx.incomingRequest.URL.Path)
			rmd := requestmeta.GetRequestMetaData(tsCtx.incomingRequest.Context())
			require.Equal(t, requestmeta.StatusSourceDownstream, rmd.StatusSource)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
		})

	newTestScenario(t, "Call resource response with 502 status code should be marked with downstream status",
		options(),
		func(t *testing.T, tsCtx *testScenarioContext) {
			tsCtx.backendTestPlugin.CallResourceHandler = backend.CallResourceHandlerFunc(func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				return sender.Send(&backend.CallResourceResponse{
					Status:  http.StatusBadGateway,
					Headers: map[string][]string{},
				})
			})

			req := createCallResourceHTTPRequest(t, tsCtx)
			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, http.StatusBadGateway, resp.StatusCode, string(b))
			require.NotNil(t, tsCtx.incomingRequest)
			require.Equal(t, "/api/datasources/uid/test-plugin/resources", tsCtx.incomingRequest.URL.Path)
			rmd := requestmeta.GetRequestMetaData(tsCtx.incomingRequest.Context())
			require.Equal(t, requestmeta.StatusSourceDownstream, rmd.StatusSource)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
		})

	newTestScenario(t, "Query data response that includes a query data response error should return expected status code and marked with downstream status",
		options(),
		func(t *testing.T, tsCtx *testScenarioContext) {
			tsCtx.backendTestPlugin.QueryDataHandler = backend.QueryDataHandlerFunc(func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				resp := backend.NewQueryDataResponse()
				resp.Responses["A"] = backend.DataResponse{
					Frames: data.Frames{},
				}
				resp.Responses["B"] = backend.DataResponse{
					Error: fmt.Errorf("BOOM"),
				}
				return resp, nil
			})

			req := createQueryDataHTTPRequest(t, tsCtx, createRegularQuery(t, tsCtx))
			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.Equal(t, http.StatusBadRequest, resp.StatusCode)
			require.NotNil(t, tsCtx.incomingRequest)
			require.Equal(t, "/api/ds/query", tsCtx.incomingRequest.URL.Path)
			rmd := requestmeta.GetRequestMetaData(tsCtx.incomingRequest.Context())
			require.Equal(t, requestmeta.StatusSourceDownstream, rmd.StatusSource)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
		})
}

type testScenarioContext struct {
	testPluginID               string
	uid                        string
	grafanaListeningAddr       string
	testEnv                    *server.TestEnv
	outgoingServer             *httptest.Server
	outgoingRequest            *http.Request
	backendTestPlugin          *testPlugin
	rt                         http.RoundTripper
	modifyIncomingRequest      func(req *http.Request)
	modifyCallResourceResponse func(sender backend.CallResourceResponseSender) error
	incomingRequest            *http.Request
}

type testScenarioInput struct {
	ds                         *datasources.AddDataSourceCommand
	token                      *oauth2.Token
	modifyIncomingRequest      func(req *http.Request)
	modifyCallResourceResponse func(sender backend.CallResourceResponseSender) error
}

type testScenarioOption func(*testScenarioInput)

func options(opts ...testScenarioOption) []testScenarioOption {
	return opts
}

func withIncomingRequest(cb func(req *http.Request)) testScenarioOption {
	return func(in *testScenarioInput) {
		in.modifyIncomingRequest = cb
	}
}

func withOAuthToken(token *oauth2.Token) testScenarioOption {
	return func(in *testScenarioInput) {
		in.token = token
	}
}

func withDsBasicAuth(username, password string) testScenarioOption {
	return func(in *testScenarioInput) {
		in.ds.BasicAuth = true
		in.ds.BasicAuthUser = username
		in.ds.SecureJsonData["basicAuthPassword"] = password
	}
}

func withDsCustomHeader(headers map[string]string) testScenarioOption {
	return func(in *testScenarioInput) {
		index := 1
		for k, v := range headers {
			in.ds.JsonData.Set(fmt.Sprintf("httpHeaderName%d", index), k)
			in.ds.SecureJsonData[fmt.Sprintf("httpHeaderValue%d", index)] = v
			index++
		}
	}
}

func withDsOAuthForwarding() testScenarioOption {
	return func(in *testScenarioInput) {
		in.ds.JsonData.Set("oauthPassThru", true)
	}
}

func withDsCookieForwarding(names []string) testScenarioOption {
	return func(in *testScenarioInput) {
		in.ds.JsonData.Set("keepCookies", names)
	}
}

func withCallResourceResponse(cb func(sender backend.CallResourceResponseSender) error) testScenarioOption {
	return func(in *testScenarioInput) {
		in.modifyCallResourceResponse = cb
	}
}

func newTestScenario(t *testing.T, name string, opts []testScenarioOption, callback func(t *testing.T, ctx *testScenarioContext)) {
	tsCtx := testScenarioContext{
		testPluginID: "test-plugin",
	}

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		// EnableLog:        true,
	})

	grafanaListeningAddr, testEnv := testinfra.StartGrafanaEnv(t, dir, path)
	testEnv.RequestMiddleware = func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tsCtx.incomingRequest = r
			next.ServeHTTP(w, r)
		})
	}
	tsCtx.grafanaListeningAddr = grafanaListeningAddr
	testEnv.Cfg.LoginCookieName = loginCookieName
	tsCtx.testEnv = testEnv
	ctx := context.Background()

	tsCtx.outgoingServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tsCtx.outgoingRequest = r
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(tsCtx.outgoingServer.Close)

	testPlugin, backendTestPlugin := createTestPlugin(tsCtx.testPluginID)
	tsCtx.backendTestPlugin = backendTestPlugin
	err := testEnv.PluginRegistry.Add(ctx, testPlugin)
	require.NoError(t, err)

	jsonData := simplejson.New()
	secureJSONData := map[string]string{}

	tsCtx.uid = "test-plugin"
	cmd := &datasources.AddDataSourceCommand{
		OrgID:          1,
		Access:         datasources.DS_ACCESS_PROXY,
		Name:           "TestPlugin",
		Type:           tsCtx.testPluginID,
		UID:            tsCtx.uid,
		URL:            tsCtx.outgoingServer.URL,
		JsonData:       jsonData,
		SecureJsonData: secureJSONData,
	}

	in := &testScenarioInput{ds: cmd}
	for _, opt := range opts {
		opt(in)
	}

	tsCtx.modifyIncomingRequest = in.modifyIncomingRequest

	if in.modifyCallResourceResponse == nil {
		in.modifyCallResourceResponse = func(sender backend.CallResourceResponseSender) error {
			responseHeaders := map[string][]string{
				"Connection":       {"close, TE"},
				"Te":               {"foo", "bar, trailers"},
				"Proxy-Connection": {"should be deleted"},
				"Upgrade":          {"foo"},
				"Set-Cookie":       {"should be deleted"},
				"X-Custom":         {"should not be deleted"},
			}

			return sender.Send(&backend.CallResourceResponse{
				Status:  http.StatusOK,
				Headers: responseHeaders,
			})
		}
	}

	tsCtx.modifyCallResourceResponse = in.modifyCallResourceResponse
	tsCtx.testEnv.OAuthTokenService.Token = in.token

	_, err = testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx, cmd)
	require.NoError(t, err)

	getDataSourceQuery := &datasources.GetDataSourceQuery{
		OrgID: 1,
		UID:   tsCtx.uid,
	}
	dataSource, err := testEnv.Server.HTTPServer.DataSourcesService.GetDataSource(ctx, getDataSourceQuery)
	require.NoError(t, err)

	rt, err := testEnv.Server.HTTPServer.DataSourcesService.GetHTTPTransport(ctx, dataSource, testEnv.HTTPClientProvider)
	require.NoError(t, err)

	tsCtx.rt = rt

	t.Run(name, func(t *testing.T) {
		callback(t, &tsCtx)
	})
}

func createRegularQuery(t *testing.T, tsCtx *testScenarioContext) dtos.MetricRequest {
	t.Helper()

	return metricRequestWithQueries(t, fmt.Sprintf(`{
		"datasource": {
			"uid": "%s"
		}
	}`, tsCtx.uid))
}

func createExpressionQuery(t *testing.T, tsCtx *testScenarioContext) dtos.MetricRequest {
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

func (tsCtx *testScenarioContext) runQueryDataTest(t *testing.T, mr dtos.MetricRequest, callback func(req *backend.QueryDataRequest)) {
	t.Run("When calling /api/ds/query should set expected headers on outgoing QueryData and HTTP request", func(t *testing.T) {
		var received *backend.QueryDataRequest
		tsCtx.backendTestPlugin.QueryDataHandler = backend.QueryDataHandlerFunc(func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			received = req

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

		req := createQueryDataHTTPRequest(t, tsCtx, mr)
		req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36")

		if tsCtx.modifyIncomingRequest != nil {
			tsCtx.modifyIncomingRequest(req)
		}

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

		require.NotEmpty(t, tsCtx.outgoingRequest.Header.Get("Accept-Encoding"))
		require.Equal(t, fmt.Sprintf("Grafana/%s", tsCtx.testEnv.Cfg.BuildVersion), tsCtx.outgoingRequest.Header.Get("User-Agent"))

		callback(received)
	})
}

func (tsCtx *testScenarioContext) runCheckHealthTest(t *testing.T, callback func(req *backend.CheckHealthRequest)) {
	t.Run("When calling /api/datasources/uid/:uid/health should set expected headers on outgoing CheckHealth and HTTP request", func(t *testing.T) {
		var received *backend.CheckHealthRequest
		tsCtx.backendTestPlugin.CheckHealthHandler = backend.CheckHealthHandlerFunc(func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
			received = req

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

		req := createCheckHealthHTTPRequest(t, tsCtx)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36")

		if tsCtx.modifyIncomingRequest != nil {
			tsCtx.modifyIncomingRequest(req)
		}

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

		require.NotEmpty(t, tsCtx.outgoingRequest.Header.Get("Accept-Encoding"))
		require.Equal(t, fmt.Sprintf("Grafana/%s", tsCtx.testEnv.Cfg.BuildVersion), tsCtx.outgoingRequest.Header.Get("User-Agent"))

		callback(received)
	})
}

func (tsCtx *testScenarioContext) runCallResourceTest(t *testing.T, callback func(req *backend.CallResourceRequest, resp *http.Response)) {
	t.Run("When calling /api/datasources/uid/:uid/resources should set expected headers on outgoing CallResource and HTTP request", func(t *testing.T) {
		var received *backend.CallResourceRequest
		tsCtx.backendTestPlugin.CallResourceHandler = backend.CallResourceHandlerFunc(func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			received = req

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

			return tsCtx.modifyCallResourceResponse(sender)
		})

		req := createCallResourceHTTPRequest(t, tsCtx)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Connection", "X-Some-Conn-Header")
		req.Header.Set("X-Some-Conn-Header", "should be deleted")
		req.Header.Set("Proxy-Connection", "should be deleted")
		req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36")

		if tsCtx.modifyIncomingRequest != nil {
			tsCtx.modifyIncomingRequest(req)
		}

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		require.Empty(t, resp.Header.Get("Connection"))
		require.Empty(t, resp.Header.Get("Te"))
		require.Empty(t, resp.Header.Get("Proxy-Connection"))
		require.Empty(t, resp.Header.Get("Upgrade"))
		require.Empty(t, resp.Header.Get("Set-Cookie"))
		require.Equal(t, "sandbox", resp.Header.Get("Content-Security-Policy"))

		require.NotNil(t, received)
		require.Empty(t, received.Headers["Connection"])
		require.Empty(t, received.Headers["X-Some-Conn-Header"])
		require.Empty(t, received.Headers["Proxy-Connection"])

		require.Empty(t, tsCtx.outgoingRequest.Header.Get("Connection"))
		require.Empty(t, tsCtx.outgoingRequest.Header.Get("X-Some-Conn-Header"))
		require.Empty(t, tsCtx.outgoingRequest.Header.Get("Proxy-Connection"))
		require.NotEmpty(t, tsCtx.outgoingRequest.Header.Get("Accept-Encoding"))
		require.Equal(t, fmt.Sprintf("Grafana/%s", tsCtx.testEnv.Cfg.BuildVersion), tsCtx.outgoingRequest.Header.Get("User-Agent"))

		callback(received, resp)
	})
}

func createCheckHealthHTTPRequest(t *testing.T, tsCtx *testScenarioContext) *http.Request {
	t.Helper()

	u := fmt.Sprintf("http://admin:admin@%s/api/datasources/uid/%s/health", tsCtx.grafanaListeningAddr, tsCtx.uid)
	req, err := http.NewRequest(http.MethodGet, u, nil)
	require.NoError(t, err)
	return req
}

func createCallResourceHTTPRequest(t *testing.T, tsCtx *testScenarioContext) *http.Request {
	t.Helper()

	u := fmt.Sprintf("http://admin:admin@%s/api/datasources/uid/%s/resources", tsCtx.grafanaListeningAddr, tsCtx.uid)
	req, err := http.NewRequest(http.MethodGet, u, nil)
	require.NoError(t, err)
	return req
}

func createQueryDataHTTPRequest(t *testing.T, tsCtx *testScenarioContext, mr dtos.MetricRequest) *http.Request {
	t.Helper()

	buf1 := &bytes.Buffer{}
	err := json.NewEncoder(buf1).Encode(mr)
	require.NoError(t, err)
	u := fmt.Sprintf("http://admin:admin@%s/api/ds/query", tsCtx.grafanaListeningAddr)

	req, err := http.NewRequest(http.MethodPost, u, buf1)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	return req
}

func createTestPlugin(id string) (*plugins.Plugin, *testPlugin) {
	p := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID: id,
		},
		Class: plugins.ClassCore,
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
	backend.AdmissionHandler
	backend.ConversionHandler
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

func (tp *testPlugin) Target() backendplugin.Target {
	return backendplugin.TargetNone
}

func (tp *testPlugin) CollectMetrics(_ context.Context, _ *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return nil, plugins.ErrMethodNotImplemented
}

func (tp *testPlugin) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if tp.CheckHealthHandler != nil {
		return tp.CheckHealthHandler.CheckHealth(ctx, req)
	}

	return nil, plugins.ErrMethodNotImplemented
}

func (tp *testPlugin) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if tp.QueryDataHandler != nil {
		return tp.QueryDataHandler.QueryData(ctx, req)
	}

	return nil, plugins.ErrMethodNotImplemented
}

func (tp *testPlugin) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if tp.CallResourceHandler != nil {
		return tp.CallResourceHandler.CallResource(ctx, req, sender)
	}

	return plugins.ErrMethodNotImplemented
}

func (tp *testPlugin) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if tp.StreamHandler != nil {
		return tp.StreamHandler.SubscribeStream(ctx, req)
	}
	return nil, plugins.ErrMethodNotImplemented
}

func (tp *testPlugin) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if tp.StreamHandler != nil {
		return tp.StreamHandler.PublishStream(ctx, req)
	}
	return nil, plugins.ErrMethodNotImplemented
}

func (tp *testPlugin) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if tp.StreamHandler != nil {
		return tp.StreamHandler.RunStream(ctx, req, sender)
	}
	return plugins.ErrMethodNotImplemented
}

// ValidateAdmission implements backend.AdmissionHandler.
func (tp *testPlugin) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	if tp.AdmissionHandler != nil {
		return tp.AdmissionHandler.ValidateAdmission(ctx, req)
	}

	return nil, plugins.ErrMethodNotImplemented
}

// MutateAdmission implements backend.AdmissionHandler.
func (tp *testPlugin) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	if tp.AdmissionHandler != nil {
		return tp.AdmissionHandler.MutateAdmission(ctx, req)
	}

	return nil, plugins.ErrMethodNotImplemented
}

// ConvertObject implements backend.AdmissionHandler.
func (tp *testPlugin) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	if tp.ConversionHandler != nil {
		return tp.ConversionHandler.ConvertObjects(ctx, req)
	}

	return nil, plugins.ErrMethodNotImplemented
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

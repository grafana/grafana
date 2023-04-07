package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/config"
	pluginClient "github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings/service"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	secretstest "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/web/webtest"
)

type fakePluginRequestValidator struct {
	err error
}

type secretsErrorResponseBody struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

func (rv *fakePluginRequestValidator) Validate(dsURL string, req *http.Request) error {
	return rv.err
}

// `/ds/query` endpoint test
func TestAPIEndpoint_Metrics_QueryMetricsV2(t *testing.T) {
	qds := query.ProvideService(
		setting.NewCfg(),
		nil,
		nil,
		&fakePluginRequestValidator{},
		&fakePluginClient{
			QueryDataHandlerFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				resp := backend.Responses{
					"A": backend.DataResponse{
						Error: errors.New("query failed"),
					},
				}
				return &backend.QueryDataResponse{Responses: resp}, nil
			},
		},
		plugincontext.ProvideService(localcache.ProvideService(), &plugins.FakePluginStore{},
			&fakeDatasources.FakeDataSourceService{}, pluginSettings.ProvideService(dbtest.NewFakeDB(),
				secretstest.NewFakeSecretsService()), plugincontext.ProvideKeyService(),
		),
	)
	serverFeatureEnabled := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.queryDataService = qds
		hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagDatasourceQueryMultiStatus, true)
		hs.QuotaService = quotatest.New(false, nil)
	})
	serverFeatureDisabled := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.queryDataService = qds
		hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagDatasourceQueryMultiStatus, false)
		hs.QuotaService = quotatest.New(false, nil)
	})

	t.Run("Status code is 400 when data source response has an error and feature toggle is disabled", func(t *testing.T) {
		req := serverFeatureDisabled.NewPostRequest("/api/ds/query", strings.NewReader(reqValid))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleViewer})
		resp, err := serverFeatureDisabled.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Status code is 207 when data source response has an error and feature toggle is enabled", func(t *testing.T) {
		req := serverFeatureEnabled.NewPostRequest("/api/ds/query", strings.NewReader(reqValid))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleViewer})
		resp, err := serverFeatureEnabled.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusMultiStatus, resp.StatusCode)
	})
}

func TestAPIEndpoint_Metrics_PluginDecryptionFailure(t *testing.T) {
	ds := &fakeDatasources.FakeDataSourceService{SimulatePluginFailure: true}
	db := &dbtest.FakeDB{ExpectedError: pluginsettings.ErrPluginSettingNotFound}
	pcp := plugincontext.ProvideService(localcache.ProvideService(),
		&plugins.FakePluginStore{
			PluginList: []plugins.PluginDTO{
				{
					JSONData: plugins.JSONData{
						ID: "grafana",
					},
				},
			},
		},
		ds, pluginSettings.ProvideService(db, secretstest.NewFakeSecretsService()),
		plugincontext.ProvideKeyService(),
	)
	qds := query.ProvideService(
		setting.NewCfg(),
		nil,
		nil,
		&fakePluginRequestValidator{},
		&fakePluginClient{
			QueryDataHandlerFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				resp := backend.Responses{
					"A": backend.DataResponse{
						Error: errors.New("query failed"),
					},
				}
				return &backend.QueryDataResponse{Responses: resp}, nil
			},
		},
		pcp,
	)
	httpServer := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.queryDataService = qds
		hs.QuotaService = quotatest.New(false, nil)
		hs.pluginContextProvider = pcp
	})

	t.Run("Status code is 500 and a secrets plugin error is returned if there is a problem getting secrets from the remote plugin", func(t *testing.T) {
		req := httpServer.NewPostRequest("/api/ds/query", strings.NewReader(reqValid))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleViewer})
		resp, err := httpServer.SendJSON(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusInternalServerError, resp.StatusCode)
		buf := new(bytes.Buffer)
		_, err = buf.ReadFrom(resp.Body)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		var resObj secretsErrorResponseBody
		err = json.Unmarshal(buf.Bytes(), &resObj)
		require.NoError(t, err)
		require.Equal(t, "unknown error", resObj.Error)
		require.Contains(t, resObj.Message, "Secrets Plugin error:")
	})
}

var reqValid = `{
	"from": "",
	"to": "",
	"queries": [
		{
			"datasource": {
				"type": "datasource",
				"uid": "grafana"
			},
			"queryType": "randomWalk",
			"refId": "A"
		}
	]
}`

var reqNoQueries = `{
	"from": "",
	"to": "",
	"queries": []
}`

var reqQueryWithInvalidDatasourceID = `{
	"from": "",
	"to": "",
	"queries": [
		{
			"queryType": "randomWalk",
			"refId": "A"
		}
	]
}`

var reqDatasourceByUidNotFound = `{
	"from": "",
	"to": "",
	"queries": [
		{
			"datasource": {
				"type": "datasource",
				"uid": "not-found"
			},
			"queryType": "randomWalk",
			"refId": "A"
		}
	]
}`

var reqDatasourceByIdNotFound = `{
	"from": "",
	"to": "",
	"queries": [
		{
			"datasourceId": 1,
			"queryType": "randomWalk",
			"refId": "A"
		}
	]
}`

func TestDataSourceQueryError(t *testing.T) {
	tcs := []struct {
		request        string
		clientErr      error
		expectedStatus int
		expectedBody   string
	}{
		{
			request:        reqValid,
			clientErr:      backendplugin.ErrPluginUnavailable,
			expectedStatus: http.StatusInternalServerError,
			expectedBody:   `{"message":"Internal server error","messageId":"plugin.unavailable","statusCode":500,"traceID":""}`,
		},
		{
			request:        reqValid,
			clientErr:      backendplugin.ErrMethodNotImplemented,
			expectedStatus: http.StatusNotImplemented,
			expectedBody:   `{"message":"Not implemented","messageId":"plugin.notImplemented","statusCode":501,"traceID":""}`,
		},
		{
			request:        reqValid,
			clientErr:      errors.New("surprise surprise"),
			expectedStatus: errutil.StatusInternal.HTTPStatus(),
			expectedBody:   `{"message":"An error occurred within the plugin","messageId":"plugin.downstreamError","statusCode":500,"traceID":""}`,
		},
		{
			request:        reqNoQueries,
			expectedStatus: http.StatusBadRequest,
			expectedBody:   `{"message":"No queries found","messageId":"query.noQueries","statusCode":400,"traceID":""}`,
		},
		{
			request:        reqQueryWithInvalidDatasourceID,
			expectedStatus: http.StatusBadRequest,
			expectedBody:   `{"message":"Query does not contain a valid data source identifier","messageId":"query.invalidDatasourceId","statusCode":400,"traceID":""}`,
		},
		{
			request:        reqDatasourceByUidNotFound,
			expectedStatus: http.StatusNotFound,
			expectedBody:   `{"error":"data source not found","message":"Data source not found","traceID":""}`,
		},
		{
			request:        reqDatasourceByIdNotFound,
			expectedStatus: http.StatusNotFound,
			expectedBody:   `{"error":"data source not found","message":"Data source not found","traceID":""}`,
		},
	}

	for _, tc := range tcs {
		t.Run(fmt.Sprintf("Plugin client error %q should propagate to API", tc.clientErr), func(t *testing.T) {
			db := dbtest.NewFakeDB()
			db.ExpectedError = pluginsettings.ErrPluginSettingNotFound
			p := &plugins.Plugin{
				JSONData: plugins.JSONData{
					ID: "grafana",
				},
			}
			p.RegisterClient(&fakePluginBackend{
				qdr: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
					return nil, tc.clientErr
				},
			})
			srv := SetupAPITestServer(t, func(hs *HTTPServer) {
				r := registry.NewInMemory()
				err := r.Add(context.Background(), p)
				require.NoError(t, err)
				ds := &fakeDatasources.FakeDataSourceService{}
				hs.queryDataService = query.ProvideService(
					setting.NewCfg(),
					&fakeDatasources.FakeCacheService{},
					nil,
					&fakePluginRequestValidator{},
					pluginClient.ProvideService(r, &config.Cfg{}),
					plugincontext.ProvideService(localcache.ProvideService(), &plugins.FakePluginStore{
						PluginList: []plugins.PluginDTO{p.ToDTO()},
					},
						ds, pluginSettings.ProvideService(dbtest.NewFakeDB(),
							secretstest.NewFakeSecretsService()), plugincontext.ProvideKeyService(),
					),
				)
				hs.QuotaService = quotatest.New(false, nil)
			})
			req := srv.NewPostRequest("/api/ds/query", strings.NewReader(tc.request))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleViewer})
			resp, err := srv.SendJSON(req)
			require.NoError(t, err)

			require.Equal(t, tc.expectedStatus, resp.StatusCode)
			require.Equal(t, tc.expectedStatus, resp.StatusCode)
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, tc.expectedBody, string(body))
			require.NoError(t, resp.Body.Close())
		})
	}
}

type fakePluginBackend struct {
	qdr backend.QueryDataHandlerFunc

	backendplugin.Plugin
}

func (f *fakePluginBackend) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if f.qdr != nil {
		return f.qdr(ctx, req)
	}
	return backend.NewQueryDataResponse(), nil
}

func (f *fakePluginBackend) IsDecommissioned() bool {
	return false
}

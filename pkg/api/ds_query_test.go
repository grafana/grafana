package api

import (
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

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	pluginClient "github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/dsquerierclient"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings/service"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	secretstest "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

type fakeDataSourceRequestValidator struct {
	err error
}

func (rv *fakeDataSourceRequestValidator) Validate(ds *datasources.DataSource, req *http.Request) error {
	return rv.err
}

// `/ds/query` endpoint test
func TestAPIEndpoint_Metrics_QueryMetricsV2(t *testing.T) {
	cfg := setting.NewCfg()
	qds := query.ProvideService(
		cfg,
		nil,
		nil,
		&fakeDataSourceRequestValidator{},
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
		plugincontext.ProvideService(
			cfg,
			localcache.ProvideService(),
			&pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{
					{
						JSONData: plugins.JSONData{
							ID: "grafana",
						},
					},
				},
			},
			&fakeDatasources.FakeCacheService{},
			&fakeDatasources.FakeDataSourceService{},
			pluginSettings.ProvideService(
				dbtest.NewFakeDB(),
				secretstest.NewFakeSecretsService(),
			),
			pluginconfig.NewFakePluginRequestConfigProvider(),
		),
		dsquerierclient.NewNullQSDatasourceClientBuilder(),
	)
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.queryDataService = qds
		hs.QuotaService = quotatest.New(false, nil)
	})

	t.Run("Status code is 400 when data source response has an error", func(t *testing.T) {
		req := server.NewPostRequest("/api/ds/query", strings.NewReader(reqValid))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {datasources.ActionQuery: []string{datasources.ScopeAll}}}})
		resp, err := server.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
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
	type body struct {
		Message    string `json:"message"`
		MessageId  string `json:"messageId"`
		StatusCode int    `json:"statusCode"`
	}

	tcs := []struct {
		request        string
		clientErr      error
		expectedStatus int
		expectedBody   body
	}{
		{
			request:        reqValid,
			clientErr:      plugins.ErrPluginUnavailable,
			expectedStatus: http.StatusInternalServerError,
			expectedBody: body{
				Message:    "Plugin unavailable",
				MessageId:  "plugin.unavailable",
				StatusCode: 500,
			},
		},
		{
			request:        reqValid,
			clientErr:      plugins.ErrMethodNotImplemented,
			expectedStatus: http.StatusNotFound,
			expectedBody: body{
				Message:    "Method not implemented",
				MessageId:  "plugin.notImplemented",
				StatusCode: 404,
			},
		},
		{
			request:        reqValid,
			clientErr:      errors.New("surprise surprise"),
			expectedStatus: errutil.StatusInternal.HTTPStatus(),
			expectedBody: body{
				Message:    "An error occurred within the plugin",
				MessageId:  "plugin.requestFailureError",
				StatusCode: 500,
			},
		},
		{
			request:        reqNoQueries,
			expectedStatus: http.StatusBadRequest,
			expectedBody: body{
				Message:    "No queries found",
				MessageId:  "query.noQueries",
				StatusCode: 400,
			},
		},
		{
			request:        reqQueryWithInvalidDatasourceID,
			expectedStatus: http.StatusBadRequest,
			expectedBody: body{
				Message:    "Query does not contain a valid data source identifier",
				MessageId:  "query.invalidDatasourceId",
				StatusCode: 400,
			},
		},
		{
			request:        reqDatasourceByUidNotFound,
			expectedStatus: http.StatusNotFound,
			expectedBody: body{
				Message: "Data source not found",
			},
		},
		{
			request:        reqDatasourceByIdNotFound,
			expectedStatus: http.StatusNotFound,
			expectedBody: body{
				Message: "Data source not found",
			},
		},
	}

	for _, tc := range tcs {
		t.Run(fmt.Sprintf("Plugin client error %q should propagate to API", tc.clientErr), func(t *testing.T) {
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
				cfg := setting.NewCfg()
				r := registry.NewInMemory()
				err := r.Add(context.Background(), p)
				require.NoError(t, err)
				ds := &fakeDatasources.FakeDataSourceService{}
				hs.queryDataService = query.ProvideService(
					cfg,
					&fakeDatasources.FakeCacheService{},
					nil,
					&fakeDataSourceRequestValidator{},
					pluginClient.ProvideService(r),
					plugincontext.ProvideService(cfg, localcache.ProvideService(), &pluginstore.FakePluginStore{
						PluginList: []pluginstore.Plugin{pluginstore.ToGrafanaDTO(p)},
					},
						&fakeDatasources.FakeCacheService{}, ds,
						pluginSettings.ProvideService(dbtest.NewFakeDB(),
							secretstest.NewFakeSecretsService()), pluginconfig.NewFakePluginRequestConfigProvider()),
					dsquerierclient.NewNullQSDatasourceClientBuilder(),
				)
				hs.QuotaService = quotatest.New(false, nil)
			})
			req := srv.NewPostRequest("/api/ds/query", strings.NewReader(tc.request))

			webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {datasources.ActionQuery: []string{datasources.ScopeAll}}}})
			resp, err := srv.SendJSON(req)
			require.NoError(t, err)

			require.Equal(t, tc.expectedStatus, resp.StatusCode)

			bodyBytes, err := io.ReadAll(resp.Body)
			require.NoError(t, err)

			var responseBody body
			err = json.Unmarshal(bodyBytes, &responseBody)
			require.NoError(t, err)

			require.Equal(t, tc.expectedBody.Message, responseBody.Message)
			require.Equal(t, tc.expectedBody.MessageId, responseBody.MessageId)
			require.Equal(t, tc.expectedBody.StatusCode, responseBody.StatusCode)

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

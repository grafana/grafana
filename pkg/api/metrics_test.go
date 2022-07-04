package api

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/web/webtest"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/models"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/query"
)

var queryDatasourceInput = `{
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

type fakePluginRequestValidator struct {
	err error
}

func (rv *fakePluginRequestValidator) Validate(_ string, _ *http.Request) error {
	return rv.err
}

type fakeOAuthTokenService struct {
	passThruEnabled bool
	token           *oauth2.Token
}

func (ts *fakeOAuthTokenService) GetCurrentOAuthToken(context.Context, *models.SignedInUser) *oauth2.Token {
	return ts.token
}

func (ts *fakeOAuthTokenService) IsOAuthPassThruEnabled(*datasources.DataSource) bool {
	return ts.passThruEnabled
}

// `/ds/query` endpoint test
func TestAPIEndpoint_Metrics_QueryMetricsV2(t *testing.T) {
	qds := mockQueryResponse(backend.Responses{
		"A": backend.DataResponse{Error: fmt.Errorf("query failed")},
	})
	serverFeatureEnabled := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.queryDataService = qds
		hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagDatasourceQueryMultiStatus, true)
	})
	serverFeatureDisabled := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.queryDataService = qds
		hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagDatasourceQueryMultiStatus, false)
	})

	t.Run("Status code is 400 when data source response has an error and feature toggle is disabled", func(t *testing.T) {
		req := serverFeatureDisabled.NewPostRequest("/api/ds/query", strings.NewReader(queryDatasourceInput))
		webtest.RequestWithSignedInUser(req, &models.SignedInUser{UserId: 1, OrgId: 1, OrgRole: models.ROLE_VIEWER})
		resp, err := serverFeatureDisabled.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Status code is 207 and body contains status field when data source response has an error and feature toggle is enabled", func(t *testing.T) {
		req := serverFeatureEnabled.NewPostRequest("/api/ds/query", strings.NewReader(queryDatasourceInput))
		webtest.RequestWithSignedInUser(req, &models.SignedInUser{UserId: 1, OrgId: 1, OrgRole: models.ROLE_VIEWER})
		resp, err := serverFeatureEnabled.SendJSON(req)
		require.NoError(t, err)
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusMultiStatus, resp.StatusCode)
		require.JSONEq(t, "{\"results\":{\"A\":{\"error\":\"query failed\",\"status\":400}}}", string(b))
		require.NoError(t, resp.Body.Close())
	})

	t.Run("Response body contains relevant status field when plugin query returns error details status", func(t *testing.T) {
		tcs := []struct {
			errStatus      backend.ErrorStatus
			expectedStatus int
		}{
			{errStatus: backend.Timeout, expectedStatus: 504},
			{errStatus: backend.Unauthorized, expectedStatus: 401},
			{errStatus: backend.ConnectionError, expectedStatus: 502},
			{errStatus: backend.Unknown, expectedStatus: 500},
			{errStatus: 12345, expectedStatus: 400},
		}

		for _, tc := range tcs {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.queryDataService = mockQueryResponse(backend.Responses{
					"A": backend.DataResponse{
						Error: fmt.Errorf("query failed"),
						ErrorDetails: &backend.ErrorDetails{
							Status: tc.errStatus,
						},
					},
				})
				hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagDatasourceQueryMultiStatus, true)
			})

			req := server.NewPostRequest("/api/ds/query", strings.NewReader(queryDatasourceInput))
			webtest.RequestWithSignedInUser(req, &models.SignedInUser{UserId: 1, OrgId: 1, OrgRole: models.ROLE_VIEWER})
			resp, err := server.SendJSON(req)
			require.NoError(t, err)
			b, err := ioutil.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, http.StatusMultiStatus, resp.StatusCode)
			require.JSONEq(t, fmt.Sprintf("{\"results\":{\"A\":{\"error\":\"query failed\",\"status\":%d}}}", tc.expectedStatus), string(b))
			require.NoError(t, resp.Body.Close())
		}
	})
}

func mockQueryResponse(resp backend.Responses) *query.Service {
	return query.ProvideService(
		nil,
		nil,
		nil,
		&fakePluginRequestValidator{},
		&fakeDatasources.FakeDataSourceService{},
		&fakePluginClient{
			QueryDataHandlerFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				return &backend.QueryDataResponse{Responses: resp}, nil
			},
		},
		&fakeOAuthTokenService{},
	)
}

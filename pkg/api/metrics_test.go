package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web/webtest"

	"golang.org/x/oauth2"

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

type secretsErrorResponseBody struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

func (rv *fakePluginRequestValidator) Validate(dsURL string, req *http.Request) error {
	return rv.err
}

type fakeOAuthTokenService struct {
	passThruEnabled bool
	token           *oauth2.Token
}

func (ts *fakeOAuthTokenService) GetCurrentOAuthToken(context.Context, *user.SignedInUser) *oauth2.Token {
	return ts.token
}

func (ts *fakeOAuthTokenService) IsOAuthPassThruEnabled(*datasources.DataSource) bool {
	return ts.passThruEnabled
}

// `/ds/query` endpoint test
func TestAPIEndpoint_Metrics_QueryMetricsV2(t *testing.T) {
	qds := query.ProvideService(
		nil,
		nil,
		nil,
		&fakePluginRequestValidator{},
		&fakeDatasources.FakeDataSourceService{},
		&fakePluginClient{
			QueryDataHandlerFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				resp := backend.Responses{
					"A": backend.DataResponse{
						Error: fmt.Errorf("query failed"),
					},
				}
				return &backend.QueryDataResponse{Responses: resp}, nil
			},
		},
		&fakeOAuthTokenService{},
	)
	serverFeatureEnabled := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.queryDataService = qds
		hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagDatasourceQueryMultiStatus, true)
		hs.QuotaService = quotatest.NewQuotaServiceFake()
	})
	serverFeatureDisabled := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.queryDataService = qds
		hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagDatasourceQueryMultiStatus, false)
		hs.QuotaService = quotatest.NewQuotaServiceFake()
	})

	t.Run("Status code is 400 when data source response has an error and feature toggle is disabled", func(t *testing.T) {
		req := serverFeatureDisabled.NewPostRequest("/api/ds/query", strings.NewReader(queryDatasourceInput))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleViewer})
		resp, err := serverFeatureDisabled.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Status code is 207 when data source response has an error and feature toggle is enabled", func(t *testing.T) {
		req := serverFeatureEnabled.NewPostRequest("/api/ds/query", strings.NewReader(queryDatasourceInput))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleViewer})
		resp, err := serverFeatureEnabled.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusMultiStatus, resp.StatusCode)
	})
}

func TestAPIEndpoint_Metrics_PluginDecryptionFailure(t *testing.T) {
	qds := query.ProvideService(
		nil,
		nil,
		nil,
		&fakePluginRequestValidator{},
		&fakeDatasources.FakeDataSourceService{SimulatePluginFailure: true},
		&fakePluginClient{
			QueryDataHandlerFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				resp := backend.Responses{
					"A": backend.DataResponse{
						Error: fmt.Errorf("query failed"),
					},
				}
				return &backend.QueryDataResponse{Responses: resp}, nil
			},
		},
		&fakeOAuthTokenService{},
	)
	httpServer := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.queryDataService = qds
		hs.QuotaService = quotatest.NewQuotaServiceFake()
	})

	t.Run("Status code is 500 and a secrets plugin error is returned if there is a problem getting secrets from the remote plugin", func(t *testing.T) {
		req := httpServer.NewPostRequest("/api/ds/query", strings.NewReader(queryDatasourceInput))
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

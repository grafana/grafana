package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/datasources/guardian"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/grafana/grafana/pkg/web/webtest"
)

const (
	testOrgID     int64  = 1
	testUserID    int64  = 1
	testUserLogin string = "testUser"
)

func TestDataSourcesProxy_userLoggedIn(t *testing.T) {
	mockSQLStore := dbtest.NewFakeDB()
	loggedInUserScenario(t, "When calling GET on", "/api/datasources/", "/api/datasources/", func(sc *scenarioContext) {
		// Stubs the database query
		ds := []*datasources.DataSource{
			{Name: "mmm"},
			{Name: "ZZZ"},
			{Name: "BBB"},
			{Name: "aaa"},
		}

		// handler func being tested
		hs := &HTTPServer{
			Cfg:         setting.NewCfg(),
			pluginStore: &pluginstore.FakePluginStore{},
			DataSourcesService: &dataSourcesServiceMock{
				expectedDatasources: ds,
			},
			dsGuardian: guardian.ProvideGuardian(),
		}
		sc.handlerFunc = hs.GetDataSources
		sc.fakeReq("GET", "/api/datasources").exec()

		respJSON := []map[string]any{}
		err := json.NewDecoder(sc.resp.Body).Decode(&respJSON)
		require.NoError(t, err)

		assert.Equal(t, "aaa", respJSON[0]["name"])
		assert.Equal(t, "BBB", respJSON[1]["name"])
		assert.Equal(t, "mmm", respJSON[2]["name"])
		assert.Equal(t, "ZZZ", respJSON[3]["name"])
	}, mockSQLStore)

	loggedInUserScenario(t, "Should be able to save a data source when calling DELETE on non-existing",
		"/api/datasources/name/12345", "/api/datasources/name/:name", func(sc *scenarioContext) {
			// handler func being tested
			hs := &HTTPServer{
				Cfg:         setting.NewCfg(),
				pluginStore: &pluginstore.FakePluginStore{},
			}
			sc.handlerFunc = hs.DeleteDataSourceByName
			sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
			assert.Equal(t, 404, sc.resp.Code)
		}, mockSQLStore)
}

// Adding data sources with invalid URLs should lead to an error.
func TestAddDataSource_InvalidURL(t *testing.T) {
	sc := setupScenarioContext(t, "/api/datasources")
	hs := &HTTPServer{
		DataSourcesService: &dataSourcesServiceMock{},
		Cfg:                setting.NewCfg(),
	}

	sc.m.Post(sc.url, routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.Req.Body = mockRequestBody(datasources.AddDataSourceCommand{
			Name:   "Test",
			URL:    "invalid:url",
			Access: "direct",
			Type:   "test",
		})
		c.SignedInUser = authedUserWithPermissions(1, 1, []ac.Permission{})
		return hs.AddDataSource(c)
	}))

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

	assert.Equal(t, 400, sc.resp.Code)
}

// Adding data sources with URLs not specifying protocol should work.
func TestAddDataSource_URLWithoutProtocol(t *testing.T) {
	const name = "Test"
	const url = "localhost:5432"

	hs := &HTTPServer{
		DataSourcesService: &dataSourcesServiceMock{
			expectedDatasource: &datasources.DataSource{},
		},
		Cfg:                  setting.NewCfg(),
		AccessControl:        acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		accesscontrolService: actest.FakeService{},
	}

	sc := setupScenarioContext(t, "/api/datasources")

	sc.m.Post(sc.url, routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.Req.Body = mockRequestBody(datasources.AddDataSourceCommand{
			Name:   name,
			URL:    url,
			Access: "direct",
			Type:   "test",
		})
		c.SignedInUser = authedUserWithPermissions(1, 1, []ac.Permission{})
		return hs.AddDataSource(c)
	}))

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

	assert.Equal(t, 200, sc.resp.Code)
}

// Using a custom header whose name matches the name specified for auth proxy header should fail
func TestAddDataSource_InvalidJSONData(t *testing.T) {
	hs := &HTTPServer{
		DataSourcesService: &dataSourcesServiceMock{},
		Cfg:                setting.NewCfg(),
	}

	sc := setupScenarioContext(t, "/api/datasources")

	hs.Cfg = setting.NewCfg()
	hs.Cfg.AuthProxy.Enabled = true
	hs.Cfg.AuthProxy.HeaderName = "X-AUTH-PROXY-HEADER"
	jsonData := simplejson.New()
	jsonData.Set("httpHeaderName1", hs.Cfg.AuthProxy.HeaderName)

	sc.m.Post(sc.url, routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.Req.Body = mockRequestBody(datasources.AddDataSourceCommand{
			Name:     "Test",
			URL:      "localhost:5432",
			Access:   "direct",
			Type:     "test",
			JsonData: jsonData,
		})
		c.SignedInUser = authedUserWithPermissions(1, 1, []ac.Permission{})
		return hs.AddDataSource(c)
	}))

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

	assert.Equal(t, 400, sc.resp.Code)
}

// Updating data sources with invalid URLs should lead to an error.
func TestUpdateDataSource_InvalidURL(t *testing.T) {
	hs := &HTTPServer{
		DataSourcesService: &dataSourcesServiceMock{},
		Cfg:                setting.NewCfg(),
	}
	sc := setupScenarioContext(t, "/api/datasources/1234")

	sc.m.Put(sc.url, routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.Req.Body = mockRequestBody(datasources.AddDataSourceCommand{
			Name:   "Test",
			URL:    "invalid:url",
			Access: "direct",
			Type:   "test",
		})
		c.SignedInUser = authedUserWithPermissions(1, 1, []ac.Permission{})
		return hs.AddDataSource(c)
	}))

	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()

	assert.Equal(t, 400, sc.resp.Code)
}

// Using a custom header whose name matches the name specified for auth proxy header should fail
func TestUpdateDataSource_InvalidJSONData(t *testing.T) {
	hs := &HTTPServer{
		DataSourcesService: &dataSourcesServiceMock{},
		Cfg:                setting.NewCfg(),
	}
	sc := setupScenarioContext(t, "/api/datasources/1234")

	hs.Cfg.AuthProxy.Enabled = true
	hs.Cfg.AuthProxy.HeaderName = "X-AUTH-PROXY-HEADER"
	jsonData := simplejson.New()
	jsonData.Set("httpHeaderName1", hs.Cfg.AuthProxy.HeaderName)

	sc.m.Put(sc.url, routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.Req.Body = mockRequestBody(datasources.AddDataSourceCommand{
			Name:     "Test",
			URL:      "localhost:5432",
			Access:   "direct",
			Type:     "test",
			JsonData: jsonData,
		})
		c.SignedInUser = authedUserWithPermissions(1, 1, []ac.Permission{})
		return hs.AddDataSource(c)
	}))

	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()

	assert.Equal(t, 400, sc.resp.Code)
}
func TestAddDataSourceTeamHTTPHeaders(t *testing.T) {
	tenantID := "1234"
	hs := &HTTPServer{
		DataSourcesService: &dataSourcesServiceMock{
			expectedDatasource: &datasources.DataSource{},
		},
		Cfg:                  setting.NewCfg(),
		Features:             featuremgmt.WithFeatures(),
		accesscontrolService: actest.FakeService{},
		AccessControl: actest.FakeAccessControl{
			ExpectedEvaluate: true,
			ExpectedErr:      nil,
		},
	}
	sc := setupScenarioContext(t, fmt.Sprintf("/api/datasources/%s", tenantID))
	hs.Cfg.AuthProxy.Enabled = true

	jsonData := simplejson.New()
	jsonData.Set("teamHttpHeaders", datasources.TeamHTTPHeaders{
		Headers: datasources.TeamHeaders{
			tenantID: []datasources.TeamHTTPHeader{
				{
					Header: "Authorization",
					Value:  "foo!=bar",
				},
			},
		},
	})
	sc.m.Put(sc.url, routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.Req.Body = mockRequestBody(datasources.AddDataSourceCommand{
			Name:     "Test",
			URL:      "localhost:5432",
			Access:   "direct",
			Type:     "test",
			JsonData: jsonData,
		})
		c.SignedInUser = authedUserWithPermissions(1, 1, []ac.Permission{
			{Action: datasources.ActionPermissionsWrite, Scope: datasources.ScopeAll},
		})
		return hs.AddDataSource(c)
	}))

	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
	assert.Equal(t, http.StatusForbidden, sc.resp.Code)

	// Parse the JSON response
	var response map[string]string
	err := json.Unmarshal(sc.resp.Body.Bytes(), &response)
	assert.NoError(t, err, "Failed to parse JSON response")

	// Check the error message in the JSON response
	assert.Equal(t, "Cannot create datasource with team HTTP headers, need to use updateDatasourceLBACRules API", response["message"])
}

// Updating data sources with URLs not specifying protocol should work.
func TestUpdateDataSource_URLWithoutProtocol(t *testing.T) {
	const name = "Test"
	const url = "localhost:5432"

	hs := &HTTPServer{
		DataSourcesService: &dataSourcesServiceMock{
			expectedDatasource: &datasources.DataSource{},
		},
		Cfg:                  setting.NewCfg(),
		AccessControl:        acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		accesscontrolService: actest.FakeService{},
	}

	sc := setupScenarioContext(t, "/api/datasources/1234")

	sc.m.Put(sc.url, routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.Req.Body = mockRequestBody(datasources.AddDataSourceCommand{
			Name:   name,
			URL:    url,
			Access: "direct",
			Type:   "test",
		})
		c.SignedInUser = authedUserWithPermissions(1, 1, []ac.Permission{})

		return hs.AddDataSource(c)
	}))

	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()

	assert.Equal(t, 200, sc.resp.Code)
}

// Updating data source name where data source with same name exists.
func TestUpdateDataSourceByID_DataSourceNameExists(t *testing.T) {
	hs := &HTTPServer{
		DataSourcesService: &dataSourcesServiceMock{
			expectedDatasource: &datasources.DataSource{},
			mockUpdateDataSource: func(ctx context.Context, cmd *datasources.UpdateDataSourceCommand) (*datasources.DataSource, error) {
				return nil, datasources.ErrDataSourceNameExists
			},
		},
		Cfg:                  setting.NewCfg(),
		AccessControl:        acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		accesscontrolService: actest.FakeService{},
		Live:                 newTestLive(t, nil),
	}

	sc := setupScenarioContext(t, "/api/datasources/1")

	sc.m.Put(sc.url, routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.Req = web.SetURLParams(c.Req, map[string]string{":id": "1"})
		c.Req.Body = mockRequestBody(datasources.UpdateDataSourceCommand{
			Access: "direct",
			Type:   "test",
			Name:   "test",
		})
		return hs.UpdateDataSourceByID(c)
	}))

	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()

	require.Equal(t, http.StatusConflict, sc.resp.Code)
}

func TestAPI_datasources_AccessControl(t *testing.T) {
	type testCase struct {
		desc         string
		urls         []string
		method       string
		body         string
		permission   []ac.Permission
		expectedCode int
	}

	tests := []testCase{
		{
			desc:   "should be able to update datasource with correct permission",
			urls:   []string{"api/datasources/1", "/api/datasources/uid/1"},
			method: http.MethodPut,
			body:   `{"name": "test", "url": "http://localhost:5432", "type": "postgresql", "access": "Proxy"}`,
			permission: []ac.Permission{
				{Action: datasources.ActionWrite, Scope: datasources.ScopeProvider.GetResourceScope("1")},
				{Action: datasources.ActionWrite, Scope: datasources.ScopeProvider.GetResourceScopeUID("1")},
			},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to update datasource without correct permission",
			urls:         []string{"api/datasources/1", "/api/datasources/uid/1"},
			method:       http.MethodPut,
			permission:   []ac.Permission{},
			expectedCode: http.StatusForbidden,
		},
		{
			desc:   "should be able to fetch datasource with correct permission",
			urls:   []string{"api/datasources/1", "/api/datasources/uid/1", "/api/datasources/name/test"},
			method: http.MethodGet,
			permission: []ac.Permission{
				{Action: datasources.ActionRead, Scope: datasources.ScopeProvider.GetResourceScope("1")},
				{Action: datasources.ActionRead, Scope: datasources.ScopeProvider.GetResourceScopeUID("1")},
				{Action: datasources.ActionRead, Scope: datasources.ScopeProvider.GetResourceScopeName("test")},
			},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to fetch datasource without correct permission",
			urls:         []string{"api/datasources/1", "/api/datasources/uid/1"},
			method:       http.MethodGet,
			permission:   []ac.Permission{},
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "should be able to create datasource with correct permission",
			urls:         []string{"/api/datasources"},
			method:       http.MethodPost,
			body:         `{"name": "test", "url": "http://localhost:5432", "type": "postgresql", "access": "Proxy"}`,
			permission:   []ac.Permission{{Action: datasources.ActionCreate}},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to create datasource without correct permission",
			urls:         []string{"/api/datasources"},
			method:       http.MethodPost,
			permission:   []ac.Permission{},
			expectedCode: http.StatusForbidden,
		},
		{
			desc:   "should be able to delete datasource with correct permission",
			urls:   []string{"/api/datasources/1", "/api/datasources/uid/1"},
			method: http.MethodDelete,
			permission: []ac.Permission{
				{Action: datasources.ActionDelete, Scope: datasources.ScopeProvider.GetResourceScope("1")},
				{Action: datasources.ActionDelete, Scope: datasources.ScopeProvider.GetResourceScopeUID("1")},
			},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to delete datasource without correct permission",
			urls:         []string{"/api/datasources/1", "/api/datasources/uid/1"},
			method:       http.MethodDelete,
			permission:   []ac.Permission{},
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.DataSourcesService = &dataSourcesServiceMock{expectedDatasource: &datasources.DataSource{}}
				hs.accesscontrolService = actest.FakeService{}
				hs.Live = newTestLive(t, hs.SQLStore)
			})

			for _, url := range tt.urls {
				var body io.Reader
				if tt.body != "" {
					body = strings.NewReader(tt.body)
				}

				res, err := server.SendJSON(webtest.RequestWithSignedInUser(server.NewRequest(tt.method, url, body), authedUserWithPermissions(1, 1, tt.permission)))
				require.NoError(t, err)
				assert.Equal(t, tt.expectedCode, res.StatusCode)
				require.NoError(t, res.Body.Close())
			}
		})
	}
}

type dataSourcesServiceMock struct {
	datasources.DataSourceService

	expectedDatasources []*datasources.DataSource
	expectedDatasource  *datasources.DataSource
	expectedError       error

	mockUpdateDataSource func(ctx context.Context, cmd *datasources.UpdateDataSourceCommand) (*datasources.DataSource, error)
}

func (m *dataSourcesServiceMock) GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	return m.expectedDatasource, m.expectedError
}

func (m *dataSourcesServiceMock) GetDataSources(ctx context.Context, query *datasources.GetDataSourcesQuery) ([]*datasources.DataSource, error) {
	return m.expectedDatasources, m.expectedError
}

func (m *dataSourcesServiceMock) GetDataSourcesByType(ctx context.Context, query *datasources.GetDataSourcesByTypeQuery) ([]*datasources.DataSource, error) {
	return m.expectedDatasources, m.expectedError
}

func (m *dataSourcesServiceMock) DeleteDataSource(ctx context.Context, cmd *datasources.DeleteDataSourceCommand) error {
	return m.expectedError
}

func (m *dataSourcesServiceMock) AddDataSource(ctx context.Context, cmd *datasources.AddDataSourceCommand) (*datasources.DataSource, error) {
	return m.expectedDatasource, m.expectedError
}

func (m *dataSourcesServiceMock) UpdateDataSource(ctx context.Context, cmd *datasources.UpdateDataSourceCommand) (*datasources.DataSource, error) {
	if m.mockUpdateDataSource != nil {
		return m.mockUpdateDataSource(ctx, cmd)
	}

	return m.expectedDatasource, m.expectedError
}

func (m *dataSourcesServiceMock) DecryptedValues(ctx context.Context, ds *datasources.DataSource) (map[string]string, error) {
	decryptedValues := make(map[string]string)
	return decryptedValues, m.expectedError
}

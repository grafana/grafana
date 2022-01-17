package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
)

const (
	testOrgID     int64  = 1
	testUserID    int64  = 1
	testUserLogin string = "testUser"
)

func TestDataSourcesProxy_userLoggedIn(t *testing.T) {
	loggedInUserScenario(t, "When calling GET on", "/api/datasources/", "/api/datasources/", func(sc *scenarioContext) {
		// Stubs the database query
		bus.AddHandler("test", func(ctx context.Context, query *models.GetDataSourcesQuery) error {
			assert.Equal(t, testOrgID, query.OrgId)
			query.Result = []*models.DataSource{
				{Name: "mmm"},
				{Name: "ZZZ"},
				{Name: "BBB"},
				{Name: "aaa"},
			}
			return nil
		})

		// handler func being tested
		hs := &HTTPServer{
			Bus:         bus.GetBus(),
			Cfg:         setting.NewCfg(),
			pluginStore: &fakePluginStore{},
		}
		sc.handlerFunc = hs.GetDataSources
		sc.fakeReq("GET", "/api/datasources").exec()

		respJSON := []map[string]interface{}{}
		err := json.NewDecoder(sc.resp.Body).Decode(&respJSON)
		require.NoError(t, err)

		assert.Equal(t, "aaa", respJSON[0]["name"])
		assert.Equal(t, "BBB", respJSON[1]["name"])
		assert.Equal(t, "mmm", respJSON[2]["name"])
		assert.Equal(t, "ZZZ", respJSON[3]["name"])
	})

	loggedInUserScenario(t, "Should be able to save a data source when calling DELETE on non-existing",
		"/api/datasources/name/12345", "/api/datasources/name/:name", func(sc *scenarioContext) {
			// handler func being tested
			hs := &HTTPServer{
				Bus:         bus.GetBus(),
				Cfg:         setting.NewCfg(),
				pluginStore: &fakePluginStore{},
			}
			sc.handlerFunc = hs.DeleteDataSourceByName
			sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
			assert.Equal(t, 404, sc.resp.Code)
		})
}

// Adding data sources with invalid URLs should lead to an error.
func TestAddDataSource_InvalidURL(t *testing.T) {
	defer bus.ClearBusHandlers()

	sc := setupScenarioContext(t, "/api/datasources")

	sc.m.Post(sc.url, routing.Wrap(func(c *models.ReqContext) response.Response {
		c.Req.Body = mockRequestBody(models.AddDataSourceCommand{
			Name:   "Test",
			Url:    "invalid:url",
			Access: "direct",
			Type:   "test",
		})
		return AddDataSource(c)
	}))

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

	assert.Equal(t, 400, sc.resp.Code)
}

// Adding data sources with URLs not specifying protocol should work.
func TestAddDataSource_URLWithoutProtocol(t *testing.T) {
	defer bus.ClearBusHandlers()

	const name = "Test"
	const url = "localhost:5432"

	// Stub handler
	bus.AddHandler("sql", func(ctx context.Context, cmd *models.AddDataSourceCommand) error {
		assert.Equal(t, name, cmd.Name)
		assert.Equal(t, url, cmd.Url)

		cmd.Result = &models.DataSource{}
		return nil
	})

	sc := setupScenarioContext(t, "/api/datasources")

	sc.m.Post(sc.url, routing.Wrap(func(c *models.ReqContext) response.Response {
		c.Req.Body = mockRequestBody(models.AddDataSourceCommand{
			Name:   name,
			Url:    url,
			Access: "direct",
			Type:   "test",
		})
		return AddDataSource(c)
	}))

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

	assert.Equal(t, 200, sc.resp.Code)
}

// Updating data sources with invalid URLs should lead to an error.
func TestUpdateDataSource_InvalidURL(t *testing.T) {
	defer bus.ClearBusHandlers()

	sc := setupScenarioContext(t, "/api/datasources/1234")

	sc.m.Put(sc.url, routing.Wrap(func(c *models.ReqContext) response.Response {
		c.Req.Body = mockRequestBody(models.AddDataSourceCommand{
			Name:   "Test",
			Url:    "invalid:url",
			Access: "direct",
			Type:   "test",
		})
		return AddDataSource(c)
	}))

	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()

	assert.Equal(t, 400, sc.resp.Code)
}

// Updating data sources with URLs not specifying protocol should work.
func TestUpdateDataSource_URLWithoutProtocol(t *testing.T) {
	defer bus.ClearBusHandlers()

	const name = "Test"
	const url = "localhost:5432"

	// Stub handler
	bus.AddHandler("sql", func(ctx context.Context, cmd *models.AddDataSourceCommand) error {
		assert.Equal(t, name, cmd.Name)
		assert.Equal(t, url, cmd.Url)

		cmd.Result = &models.DataSource{}
		return nil
	})

	sc := setupScenarioContext(t, "/api/datasources/1234")

	sc.m.Put(sc.url, routing.Wrap(func(c *models.ReqContext) response.Response {
		c.Req.Body = mockRequestBody(models.AddDataSourceCommand{
			Name:   name,
			Url:    url,
			Access: "direct",
			Type:   "test",
		})
		return AddDataSource(c)
	}))

	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()

	assert.Equal(t, 200, sc.resp.Code)
}

func TestAPI_Datasources_AccessControl(t *testing.T) {
	testDatasource := models.DataSource{
		Id:     3,
		Uid:    "testUID",
		OrgId:  testOrgID,
		Name:   "test",
		Url:    "http://localhost:5432",
		Type:   "postgresql",
		Access: "Proxy",
	}
	getDatasourceStub := func(ctx context.Context, query *models.GetDataSourceQuery) error {
		result := testDatasource
		result.Id = query.Id
		result.OrgId = query.OrgId
		query.Result = &result
		return nil
	}
	getDatasourcesStub := func(ctx context.Context, cmd *models.GetDataSourcesQuery) error {
		cmd.Result = []*models.DataSource{}
		return nil
	}
	addDatasourceStub := func(ctx context.Context, cmd *models.AddDataSourceCommand) error {
		cmd.Result = &testDatasource
		return nil
	}
	updateDatasourceStub := func(ctx context.Context, cmd *models.UpdateDataSourceCommand) error {
		cmd.Result = &testDatasource
		return nil
	}
	deleteDatasourceStub := func(ctx context.Context, cmd *models.DeleteDataSourceCommand) error {
		cmd.DeletedDatasourcesCount = 1
		return nil
	}
	addDatasourceBody := func() io.Reader {
		s, _ := json.Marshal(models.AddDataSourceCommand{
			Name:   "test",
			Url:    "http://localhost:5432",
			Type:   "postgresql",
			Access: "Proxy",
		})
		return bytes.NewReader(s)
	}
	updateDatasourceBody := func() io.Reader {
		s, _ := json.Marshal(models.UpdateDataSourceCommand{
			Name:   "test",
			Url:    "http://localhost:5432",
			Type:   "postgresql",
			Access: "Proxy",
		})
		return bytes.NewReader(s)
	}

	type acTestCaseWithHandler struct {
		busStubs []bus.HandlerFunc
		body     func() io.Reader
		accessControlTestCase
	}
	tests := []acTestCaseWithHandler{
		{
			busStubs: []bus.HandlerFunc{getDatasourcesStub},
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusOK,
				desc:         "DatasourcesGet should return 200 for user with correct permissions",
				url:          "/api/datasources/",
				method:       http.MethodGet,
				permissions:  []*accesscontrol.Permission{{Action: ActionDatasourcesRead, Scope: ScopeDatasourcesAll}},
			},
		},
		{
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusForbidden,
				desc:         "DatasourcesGet should return 403 for user without required permissions",
				url:          "/api/datasources/",
				method:       http.MethodGet,
				permissions:  []*accesscontrol.Permission{{Action: "wrong"}},
			},
		},
		{
			busStubs: []bus.HandlerFunc{addDatasourceStub},
			body:     addDatasourceBody,
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusOK,
				desc:         "DatasourcesPost should return 200 for user with correct permissions",
				url:          "/api/datasources/",
				method:       http.MethodPost,
				permissions:  []*accesscontrol.Permission{{Action: ActionDatasourcesCreate}},
			},
		},
		{
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusForbidden,
				desc:         "DatasourcesPost should return 403 for user without required permissions",
				url:          "/api/datasources/",
				method:       http.MethodPost,
				permissions:  []*accesscontrol.Permission{{Action: "wrong"}},
			},
		},
		{
			busStubs: []bus.HandlerFunc{getDatasourceStub, updateDatasourceStub},
			body:     updateDatasourceBody,
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusOK,
				desc:         "DatasourcesPut should return 200 for user with correct permissions",
				url:          fmt.Sprintf("/api/datasources/%v", testDatasource.Id),
				method:       http.MethodPut,
				permissions: []*accesscontrol.Permission{
					{
						Action: ActionDatasourcesWrite,
						Scope:  fmt.Sprintf("datasources:id:%v", testDatasource.Id),
					},
				},
			},
		},
		{
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusForbidden,
				desc:         "DatasourcesPut should return 403 for user without required permissions",
				url:          fmt.Sprintf("/api/datasources/%v", testDatasource.Id),
				method:       http.MethodPut,
				permissions:  []*accesscontrol.Permission{{Action: "wrong"}},
			},
		},
		{
			busStubs: []bus.HandlerFunc{getDatasourceStub, deleteDatasourceStub},
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusOK,
				desc:         "DatasourcesDeleteByID should return 200 for user with correct permissions",
				url:          fmt.Sprintf("/api/datasources/%v", testDatasource.Id),
				method:       http.MethodDelete,
				permissions: []*accesscontrol.Permission{
					{
						Action: ActionDatasourcesDelete,
						Scope:  fmt.Sprintf("datasources:id:%v", testDatasource.Id),
					},
				},
			},
		},
		{
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusForbidden,
				desc:         "DatasourcesDeleteByID should return 403 for user without required permissions",
				url:          fmt.Sprintf("/api/datasources/%v", testDatasource.Id),
				method:       http.MethodDelete,
				permissions:  []*accesscontrol.Permission{{Action: "wrong"}},
			},
		},
		{
			busStubs: []bus.HandlerFunc{getDatasourceStub, deleteDatasourceStub},
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusOK,
				desc:         "DatasourcesDeleteByUID should return 200 for user with correct permissions",
				url:          fmt.Sprintf("/api/datasources/uid/%v", testDatasource.Uid),
				method:       http.MethodDelete,
				permissions: []*accesscontrol.Permission{
					{
						Action: ActionDatasourcesDelete,
						Scope:  fmt.Sprintf("datasources:uid:%v", testDatasource.Uid),
					},
				},
			},
		},
		{
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusForbidden,
				desc:         "DatasourcesDeleteByUID should return 403 for user without required permissions",
				url:          fmt.Sprintf("/api/datasources/uid/%v", testDatasource.Uid),
				method:       http.MethodDelete,
				permissions:  []*accesscontrol.Permission{{Action: "wrong"}},
			},
		},
		{
			busStubs: []bus.HandlerFunc{getDatasourceStub, deleteDatasourceStub},
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusOK,
				desc:         "DatasourcesDeleteByName should return 200 for user with correct permissions",
				url:          fmt.Sprintf("/api/datasources/name/%v", testDatasource.Name),
				method:       http.MethodDelete,
				permissions: []*accesscontrol.Permission{
					{
						Action: ActionDatasourcesDelete,
						Scope:  fmt.Sprintf("datasources:name:%v", testDatasource.Name),
					},
				},
			},
		},
		{
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusForbidden,
				desc:         "DatasourcesDeleteByName should return 403 for user without required permissions",
				url:          fmt.Sprintf("/api/datasources/name/%v", testDatasource.Name),
				method:       http.MethodDelete,
				permissions:  []*accesscontrol.Permission{{Action: "wrong"}},
			},
		},
		{
			busStubs: []bus.HandlerFunc{getDatasourceStub},
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusOK,
				desc:         "DatasourcesGetByID should return 200 for user with correct permissions",
				url:          fmt.Sprintf("/api/datasources/%v", testDatasource.Id),
				method:       http.MethodGet,
				permissions: []*accesscontrol.Permission{
					{
						Action: ActionDatasourcesRead,
						Scope:  fmt.Sprintf("datasources:id:%v", testDatasource.Id),
					},
				},
			},
		},
		{
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusForbidden,
				desc:         "DatasourcesGetByID should return 403 for user without required permissions",
				url:          fmt.Sprintf("/api/datasources/%v", testDatasource.Id),
				method:       http.MethodGet,
				permissions:  []*accesscontrol.Permission{{Action: "wrong"}},
			},
		},
		{
			busStubs: []bus.HandlerFunc{getDatasourceStub},
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusOK,
				desc:         "DatasourcesGetByUID should return 200 for user with correct permissions",
				url:          fmt.Sprintf("/api/datasources/uid/%v", testDatasource.Uid),
				method:       http.MethodGet,
				permissions: []*accesscontrol.Permission{
					{
						Action: ActionDatasourcesRead,
						Scope:  fmt.Sprintf("datasources:uid:%v", testDatasource.Uid),
					},
				},
			},
		},
		{
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusForbidden,
				desc:         "DatasourcesGetByUID should return 403 for user without required permissions",
				url:          fmt.Sprintf("/api/datasources/uid/%v", testDatasource.Uid),
				method:       http.MethodGet,
				permissions:  []*accesscontrol.Permission{{Action: "wrong"}},
			},
		},
		{
			busStubs: []bus.HandlerFunc{getDatasourceStub},
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusOK,
				desc:         "DatasourcesGetByName should return 200 for user with correct permissions",
				url:          fmt.Sprintf("/api/datasources/name/%v", testDatasource.Name),
				method:       http.MethodGet,
				permissions: []*accesscontrol.Permission{
					{
						Action: ActionDatasourcesRead,
						Scope:  fmt.Sprintf("datasources:name:%v", testDatasource.Name),
					},
				},
			},
		},
		{
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusForbidden,
				desc:         "DatasourcesGetByName should return 403 for user without required permissions",
				url:          fmt.Sprintf("/api/datasources/name/%v", testDatasource.Name),
				method:       http.MethodGet,
				permissions:  []*accesscontrol.Permission{{Action: "wrong"}},
			},
		},
		{
			busStubs: []bus.HandlerFunc{getDatasourceStub},
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusOK,
				desc:         "DatasourcesGetIdByName should return 200 for user with correct permissions",
				url:          fmt.Sprintf("/api/datasources/id/%v", testDatasource.Name),
				method:       http.MethodGet,
				permissions: []*accesscontrol.Permission{
					{
						Action: ActionDatasourcesIDRead,
						Scope:  fmt.Sprintf("datasources:name:%v", testDatasource.Name),
					},
				},
			},
		},
		{
			accessControlTestCase: accessControlTestCase{
				expectedCode: http.StatusForbidden,
				desc:         "DatasourcesGetIdByName should return 403 for user without required permissions",
				url:          fmt.Sprintf("/api/datasources/id/%v", testDatasource.Name),
				method:       http.MethodGet,
				permissions:  []*accesscontrol.Permission{{Action: "wrong"}},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			t.Cleanup(bus.ClearBusHandlers)
			for i, handler := range test.busStubs {
				bus.AddHandler(fmt.Sprintf("test_handler_%v", i), handler)
			}

			cfg := setting.NewCfg()
			sc, hs := setupAccessControlScenarioContext(t, cfg, test.url, test.permissions)

			// Create a middleware to pretend user is logged in
			pretendSignInMiddleware := func(c *models.ReqContext) {
				sc.context = c
				sc.context.UserId = testUserID
				sc.context.OrgId = testOrgID
				sc.context.Login = testUserLogin
				sc.context.OrgRole = models.ROLE_VIEWER
				sc.context.IsSignedIn = true
			}
			sc.m.Use(pretendSignInMiddleware)

			sc.resp = httptest.NewRecorder()
			hs.SettingsProvider = &setting.OSSImpl{Cfg: cfg}

			var err error
			if test.body != nil {
				sc.req, err = http.NewRequest(test.method, test.url, test.body())
				sc.req.Header.Add("Content-Type", "application/json")
			} else {
				sc.req, err = http.NewRequest(test.method, test.url, nil)
			}
			assert.NoError(t, err)

			sc.exec()
			assert.Equal(t, test.expectedCode, sc.resp.Code)
		})
	}
}

package api

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestAnnotationsAPIEndpoint(t *testing.T) {
	hs := setupSimpleHTTPServer(nil)
	store := db.InitTestDB(t)
	store.Cfg = hs.Cfg
	hs.SQLStore = store

	t.Run("Given an annotation without a dashboard ID", func(t *testing.T) {
		cmd := dtos.PostAnnotationsCmd{
			Time: 1000,
			Text: "annotation text",
			Tags: []string{"tag1", "tag2"},
		}

		updateCmd := dtos.UpdateAnnotationsCmd{
			Time: 1000,
			Text: "annotation text",
			Tags: []string{"tag1", "tag2"},
		}

		patchCmd := dtos.PatchAnnotationsCmd{
			Time: 1000,
			Text: "annotation text",
			Tags: []string{"tag1", "tag2"},
		}

		t.Run("When user is an Org Viewer", func(t *testing.T) {
			role := org.RoleViewer
			t.Run("Should not be allowed to save an annotation", func(t *testing.T) {
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role,
					cmd, store, nil, func(sc *scenarioContext) {
						sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
						assert.Equal(t, 403, sc.resp.Code)
					})

				putAnnotationScenario(t, "When calling PUT on", "/api/annotations/1", "/api/annotations/:annotationId",
					role, updateCmd, func(sc *scenarioContext) {
						sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
						assert.Equal(t, 403, sc.resp.Code)
					})

				patchAnnotationScenario(t, "When calling PATCH on", "/api/annotations/1",
					"/api/annotations/:annotationId", role, patchCmd, func(sc *scenarioContext) {
						sc.fakeReqWithParams("PATCH", sc.url, map[string]string{}).exec()
						assert.Equal(t, 403, sc.resp.Code)
					})

				mock := dbtest.NewFakeDB()
				loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/annotations/1",
					"/api/annotations/:annotationId", role, func(sc *scenarioContext) {
						sc.handlerFunc = hs.DeleteAnnotationByID
						sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
						assert.Equal(t, 403, sc.resp.Code)
					}, mock)
			})
		})

		t.Run("When user is an Org Editor", func(t *testing.T) {
			role := org.RoleEditor
			t.Run("Should be able to save an annotation", func(t *testing.T) {
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role,
					cmd, store, nil, func(sc *scenarioContext) {
						sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
						assert.Equal(t, 200, sc.resp.Code)
					})

				putAnnotationScenario(t, "When calling PUT on", "/api/annotations/1", "/api/annotations/:annotationId", role, updateCmd, func(sc *scenarioContext) {
					sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				patchAnnotationScenario(t, "When calling PATCH on", "/api/annotations/1", "/api/annotations/:annotationId", role, patchCmd, func(sc *scenarioContext) {
					sc.fakeReqWithParams("PATCH", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})
				mock := dbtest.NewFakeDB()
				loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/annotations/1",
					"/api/annotations/:annotationId", role, func(sc *scenarioContext) {
						sc.handlerFunc = hs.DeleteAnnotationByID
						sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
						assert.Equal(t, 200, sc.resp.Code)
					}, mock)
			})
		})
	})

	t.Run("Given an annotation with a dashboard ID and the dashboard does not have an ACL", func(t *testing.T) {
		cmd := dtos.PostAnnotationsCmd{
			Time:        1000,
			Text:        "annotation text",
			Tags:        []string{"tag1", "tag2"},
			DashboardId: 1,
			PanelId:     1,
		}

		dashboardUIDCmd := dtos.PostAnnotationsCmd{
			Time:         1000,
			Text:         "annotation text",
			Tags:         []string{"tag1", "tag2"},
			DashboardUID: "home",
			PanelId:      1,
		}

		updateCmd := dtos.UpdateAnnotationsCmd{
			Time: 1000,
			Text: "annotation text",
			Tags: []string{"tag1", "tag2"},
			Id:   1,
		}

		patchCmd := dtos.PatchAnnotationsCmd{
			Time: 8000,
			Text: "annotation text 50",
			Tags: []string{"foo", "bar"},
			Id:   1,
		}

		deleteCmd := dtos.MassDeleteAnnotationsCmd{
			DashboardId: 1,
			PanelId:     1,
		}

		deleteWithDashboardUIDCmd := dtos.MassDeleteAnnotationsCmd{
			DashboardUID: "home",
			PanelId:      1,
		}

		t.Run("When user is an Org Viewer", func(t *testing.T) {
			role := org.RoleViewer
			dashSvc := dashboards.NewFakeDashboardService(t)
			t.Run("Should not be allowed to save an annotation", func(t *testing.T) {
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role, cmd, store, dashSvc, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
					assert.Equal(t, 403, sc.resp.Code)
				})

				putAnnotationScenario(t, "When calling PUT on", "/api/annotations/1", "/api/annotations/:annotationId", role, updateCmd, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
					assert.Equal(t, 403, sc.resp.Code)
				})

				patchAnnotationScenario(t, "When calling PATCH on", "/api/annotations/1", "/api/annotations/:annotationId", role, patchCmd, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("PATCH", sc.url, map[string]string{}).exec()
					assert.Equal(t, 403, sc.resp.Code)
				})
				mock := dbtest.NewFakeDB()
				loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/annotations/1",
					"/api/annotations/:annotationId", role, func(sc *scenarioContext) {
						setUpACL()
						sc.handlerFunc = hs.DeleteAnnotationByID
						sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
						assert.Equal(t, 403, sc.resp.Code)
					}, mock)
			})
		})

		t.Run("When user is an Org Editor", func(t *testing.T) {
			role := org.RoleEditor
			t.Run("Should be able to save an annotation", func(t *testing.T) {
				dashSvc := dashboards.NewFakeDashboardService(t)
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role, cmd, store, dashSvc, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				putAnnotationScenario(t, "When calling PUT on", "/api/annotations/1", "/api/annotations/:annotationId", role, updateCmd, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				patchAnnotationScenario(t, "When calling PATCH on", "/api/annotations/1", "/api/annotations/:annotationId", role, patchCmd, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("PATCH", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})
				mock := dbtest.NewFakeDB()
				loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/annotations/1",
					"/api/annotations/:annotationId", role, func(sc *scenarioContext) {
						setUpACL()
						sc.handlerFunc = hs.DeleteAnnotationByID
						sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
						assert.Equal(t, 200, sc.resp.Code)
					}, mock)
			})
		})

		t.Run("When user is an Admin", func(t *testing.T) {
			role := org.RoleAdmin

			mockStore := dbtest.NewFakeDB()

			t.Run("Should be able to do anything", func(t *testing.T) {
				dashSvc := dashboards.NewFakeDashboardService(t)
				result := &dashboards.Dashboard{}
				dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(result, nil)
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role, cmd, store, dashSvc, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role, dashboardUIDCmd, mockStore, dashSvc, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)

					dashSvc.AssertCalled(t, "GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery"))
				})

				putAnnotationScenario(t, "When calling PUT on", "/api/annotations/1", "/api/annotations/:annotationId", role, updateCmd, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				patchAnnotationScenario(t, "When calling PATCH on", "/api/annotations/1", "/api/annotations/:annotationId", role, patchCmd, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("PATCH", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				deleteAnnotationsScenario(t, "When calling POST on", "/api/annotations/mass-delete",
					"/api/annotations/mass-delete", role, deleteCmd, store, nil, func(sc *scenarioContext) {
						setUpACL()
						sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
						assert.Equal(t, 200, sc.resp.Code)
					})

				dashSvc = dashboards.NewFakeDashboardService(t)
				result = &dashboards.Dashboard{
					ID:  1,
					UID: deleteWithDashboardUIDCmd.DashboardUID,
				}
				dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Run(func(args mock.Arguments) {
					q := args.Get(1).(*dashboards.GetDashboardQuery)
					result = &dashboards.Dashboard{
						ID:  q.ID,
						UID: deleteWithDashboardUIDCmd.DashboardUID,
					}
				}).Return(result, nil)
				deleteAnnotationsScenario(t, "When calling POST with dashboardUID on", "/api/annotations/mass-delete",
					"/api/annotations/mass-delete", role, deleteWithDashboardUIDCmd, mockStore, dashSvc, func(sc *scenarioContext) {
						setUpACL()
						sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
						assert.Equal(t, 200, sc.resp.Code)
						dashSvc.AssertCalled(t, "GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery"))
					})
			})
		})
	})
}

func postAnnotationScenario(t *testing.T, desc string, url string, routePattern string, role org.RoleType,
	cmd dtos.PostAnnotationsCmd, store db.DB, dashSvc *dashboards.FakeDashboardService, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := setupSimpleHTTPServer(nil)
		hs.SQLStore = store
		hs.DashboardService = dashSvc

		sc := setupScenarioContext(t, url)
		sc.dashboardService = dashSvc

		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.UserID = testUserID
			sc.context.OrgID = testOrgID
			sc.context.OrgRole = role
			return hs.PostAnnotation(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)
		fn(sc)
	})
}

func putAnnotationScenario(t *testing.T, desc string, url string, routePattern string, role org.RoleType,
	cmd dtos.UpdateAnnotationsCmd, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := setupSimpleHTTPServer(nil)
		store := db.InitTestDB(t)
		store.Cfg = hs.Cfg
		hs.SQLStore = store

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.UserID = testUserID
			sc.context.OrgID = testOrgID
			sc.context.OrgRole = role

			return hs.UpdateAnnotation(c)
		})

		sc.m.Put(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func patchAnnotationScenario(t *testing.T, desc string, url string, routePattern string, role org.RoleType, cmd dtos.PatchAnnotationsCmd, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := setupSimpleHTTPServer(nil)
		store := db.InitTestDB(t)
		store.Cfg = hs.Cfg
		hs.SQLStore = store

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.UserID = testUserID
			sc.context.OrgID = testOrgID
			sc.context.OrgRole = role

			return hs.PatchAnnotation(c)
		})

		sc.m.Patch(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func deleteAnnotationsScenario(t *testing.T, desc string, url string, routePattern string, role org.RoleType,
	cmd dtos.MassDeleteAnnotationsCmd, store db.DB, dashSvc dashboards.DashboardService, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := setupSimpleHTTPServer(nil)
		hs.SQLStore = store
		hs.DashboardService = dashSvc

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.UserID = testUserID
			sc.context.OrgID = testOrgID
			sc.context.OrgRole = role

			return hs.MassDeleteAnnotations(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func TestAPI_Annotations_AccessControl(t *testing.T) {
	type testCase struct {
		desc         string
		path         string
		method       string
		body         string
		expectedCode int
		permissions  []accesscontrol.Permission
	}

	tests := []testCase{
		{
			desc:         "should be able to fetch annotations with correct permission",
			path:         "/api/annotations",
			method:       http.MethodGet,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead, Scope: accesscontrol.ScopeAnnotationsAll}},
		},
		{
			desc:         "should not be able to fetch annotations without correct permission",
			path:         "/api/annotations",
			method:       http.MethodGet,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{},
		},
		{
			desc:         "should be able to fetch annotation by id with correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodGet,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead, Scope: accesscontrol.ScopeAnnotationsAll}},
		},
		{
			desc:         "should not be able to fetch annotation by id without correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodGet,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{},
		},
		{
			desc:         "should be able to fetch annotation tags with correct permission",
			path:         "/api/annotations/tags",
			method:       http.MethodGet,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead}},
		},
		{
			desc:         "should not be able to fetch annotation tags without correct permission",
			path:         "/api/annotations/tags",
			method:       http.MethodGet,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{},
		},
		{
			desc:         "should be able to update dashboard annotation with correct permission",
			path:         "/api/annotations/2",
			method:       http.MethodPut,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should not be able to update dashboard annotation without correct permission",
			path:         "/api/annotations/2",
			method:       http.MethodPut,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{},
		},
		{
			desc:         "should be able to update organization annotation with correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodPut,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should not be able to update organization annotation without correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodPut,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to patch dashboard annotation with correct permission",
			path:         "/api/annotations/2",
			method:       http.MethodPatch,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should not be able to patch dashboard annotation without correct permission",
			path:         "/api/annotations/2",
			method:       http.MethodPatch,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{},
		},
		{
			desc:         "should be able to patch organization annotation with correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodPatch,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should not be able to patch organization annotation without correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodPatch,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to create dashboard annotation with correct permission",
			path:         "/api/annotations",
			method:       http.MethodPost,
			body:         "{\"dashboardId\": 2,\"text\": \"test\"}",
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should not be able to create dashboard annotation without correct permission",
			path:         "/api/annotations",
			method:       http.MethodPost,
			body:         "{\"dashboardId\": 2,\"text\": \"test\"}",
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should be able to create organization annotation with correct permission",
			path:         "/api/annotations",
			method:       http.MethodPost,
			body:         "{\"text\": \"test\"}",
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should not be able to create organization annotation without correct permission",
			path:         "/api/annotations",
			method:       http.MethodPost,
			body:         "{\"text\": \"test\"}",
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to delete dashboard annotation with correct permission",
			path:         "/api/annotations/2",
			method:       http.MethodDelete,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should not be able to delete dashboard annotation without correct permission",
			path:         "/api/annotations/2",
			method:       http.MethodDelete,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should be able to delete organization annotation with correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodDelete,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should not be able to delete organization annotation without correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodDelete,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to create graphite annotation with correct permission",
			path:         "/api/annotations/graphite",
			body:         "{\"what\": \"test\", \"tags\": []}",
			method:       http.MethodPost,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should not be able to create graphite annotation without correct permission",
			path:         "/api/annotations/graphite",
			method:       http.MethodPost,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to mass delete dashboard annotations with correct permission",
			path:         "/api/annotations/mass-delete",
			body:         "{\"dashboardId\": 2, \"panelId\": 1}",
			method:       http.MethodPost,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should not be able to mass delete dashboard annotations without correct permission",
			path:         "/api/annotations/mass-delete",
			body:         "{\"dashboardId\": 2, \"panelId\": 1}",
			method:       http.MethodPost,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			setUpRBACGuardian(t)
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				repo := annotationstest.NewFakeAnnotationsRepo()
				_ = repo.Save(context.Background(), &annotations.Item{ID: 1, DashboardID: 0})
				_ = repo.Save(context.Background(), &annotations.Item{ID: 2, DashboardID: 1})
				hs.annotationsRepo = repo
				hs.AccessControl = acimpl.ProvideAccessControl(hs.Cfg)
				hs.AccessControl.RegisterScopeAttributeResolver(AnnotationTypeScopeResolver(hs.annotationsRepo))
			})
			var body io.Reader
			if tt.body != "" {
				body = strings.NewReader(tt.body)
			}

			req := webtest.RequestWithSignedInUser(server.NewRequest(tt.method, tt.path, body), userWithPermissions(1, tt.permissions))
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}
func TestService_AnnotationTypeScopeResolver(t *testing.T) {
	type testCaseResolver struct {
		desc    string
		given   string
		want    string
		wantErr error
	}

	testCases := []testCaseResolver{
		{
			desc:    "correctly resolves dashboard annotations",
			given:   "annotations:id:1",
			want:    accesscontrol.ScopeAnnotationsTypeDashboard,
			wantErr: nil,
		},
		{
			desc:    "correctly resolves organization annotations",
			given:   "annotations:id:2",
			want:    accesscontrol.ScopeAnnotationsTypeOrganization,
			wantErr: nil,
		},
		{
			desc:    "invalid annotation ID",
			given:   "annotations:id:123abc",
			want:    "",
			wantErr: accesscontrol.ErrInvalidScope,
		},
		{
			desc:    "malformed scope",
			given:   "annotations:1",
			want:    "",
			wantErr: accesscontrol.ErrInvalidScope,
		},
	}

	dashboardAnnotation := annotations.Item{ID: 1, DashboardID: 1}
	organizationAnnotation := annotations.Item{ID: 2}

	fakeAnnoRepo := annotationstest.NewFakeAnnotationsRepo()
	_ = fakeAnnoRepo.Save(context.Background(), &dashboardAnnotation)
	_ = fakeAnnoRepo.Save(context.Background(), &organizationAnnotation)

	prefix, resolver := AnnotationTypeScopeResolver(fakeAnnoRepo)
	require.Equal(t, "annotations:id:", prefix)

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			resolved, err := resolver.Resolve(context.Background(), 1, tc.given)
			if tc.wantErr != nil {
				require.Error(t, err)
				require.Equal(t, tc.wantErr, err)
			} else {
				require.NoError(t, err)
				require.Len(t, resolved, 1)
				require.Equal(t, tc.want, resolved[0])
			}
		})
	}
}

func setUpACL() {
	viewerRole := org.RoleViewer
	editorRole := org.RoleEditor
	store := dbtest.NewFakeDB()
	teamSvc := &teamtest.FakeService{}
	dashSvc := &dashboards.FakeDashboardService{}
	qResult := []*dashboards.DashboardACLInfoDTO{
		{Role: &viewerRole, Permission: dashboards.PERMISSION_VIEW},
		{Role: &editorRole, Permission: dashboards.PERMISSION_EDIT},
	}
	dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardACLInfoListQuery")).Run(func(args mock.Arguments) {
		// q := args.Get(1).(*dashboards.GetDashboardACLInfoListQuery)

	}).Return(qResult, nil)
	var result *dashboards.Dashboard
	dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Run(func(args mock.Arguments) {
		q := args.Get(1).(*dashboards.GetDashboardQuery)
		result = &dashboards.Dashboard{
			ID:  q.ID,
			UID: q.UID,
		}
	}).Return(result, nil)

	guardian.InitLegacyGuardian(store, dashSvc, teamSvc)
}

func setUpRBACGuardian(t *testing.T) {
	origNewGuardian := guardian.New
	t.Cleanup(func() {
		guardian.New = origNewGuardian
	})

	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanEditValue: true})
}

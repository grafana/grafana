package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	dboards "github.com/grafana/grafana/pkg/dashboards"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/macaron.v1"
)

func TestGetHomeDashboard(t *testing.T) {
	httpReq, err := http.NewRequest(http.MethodGet, "", nil)
	require.NoError(t, err)
	req := &models.ReqContext{SignedInUser: &models.SignedInUser{}, Context: &macaron.Context{Req: macaron.Request{Request: httpReq}}}
	cfg := setting.NewCfg()
	cfg.StaticRootPath = "../../public/"

	hs := &HTTPServer{
		Cfg: cfg, Bus: bus.New(),
		PluginManager: &fakePluginManager{},
	}
	hs.Bus.AddHandlerCtx(func(_ context.Context, query *models.GetPreferencesWithDefaultsQuery) error {
		query.Result = &models.Preferences{
			HomeDashboardId: 0,
		}
		return nil
	})

	tests := []struct {
		name                  string
		defaultSetting        string
		expectedDashboardPath string
	}{
		{name: "using default config", defaultSetting: "", expectedDashboardPath: "../../public/dashboards/home.json"},
		{name: "custom path", defaultSetting: "../../public/dashboards/default.json", expectedDashboardPath: "../../public/dashboards/default.json"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			dash := dtos.DashboardFullWithMeta{}
			dash.Meta.IsHome = true
			dash.Meta.FolderTitle = "General"

			homeDashJSON, err := ioutil.ReadFile(tc.expectedDashboardPath)
			require.NoError(t, err, "must be able to read expected dashboard file")
			hs.Cfg.DefaultHomeDashboardPath = tc.defaultSetting
			bytes, err := simplejson.NewJson(homeDashJSON)
			require.NoError(t, err, "must be able to encode file as JSON")

			dash.Dashboard = bytes

			b, err := json.Marshal(dash)
			require.NoError(t, err, "must be able to marshal object to JSON")

			res := hs.GetHomeDashboard(req)
			nr, ok := res.(*response.NormalResponse)
			require.True(t, ok, "should return *NormalResponse")
			require.Equal(t, b, nr.Body(), "default home dashboard should equal content on disk")
		})
	}
}

type testState struct {
	dashQueries []*models.GetDashboardQuery
}

func newTestLive(t *testing.T) *live.GrafanaLive {
	gLive := live.NewGrafanaLive()
	gLive.RouteRegister = routing.NewRouteRegister()
	gLive.Cfg = &setting.Cfg{AppURL: "http://localhost:3000/"}
	err := gLive.Init()
	require.NoError(t, err)
	return gLive
}

// This tests three main scenarios.
// If a user has access to execute an action on a dashboard:
//   1. and the dashboard is in a folder which does not have an acl
//   2. and the dashboard is in a folder which does have an acl
// 3. Post dashboard response tests

func TestDashboardAPIEndpoint(t *testing.T) {
	t.Run("Given a dashboard with a parent folder which does not have an ACL", func(t *testing.T) {
		setUp := func() *testState {
			fakeDash := models.NewDashboard("Child dash")
			fakeDash.Id = 1
			fakeDash.FolderId = 1
			fakeDash.HasAcl = false

			bus.AddHandler("test", func(query *models.GetDashboardsBySlugQuery) error {
				dashboards := []*models.Dashboard{fakeDash}
				query.Result = dashboards
				return nil
			})

			state := &testState{}

			bus.AddHandlerCtx("test", func(ctx context.Context, query *models.GetDashboardQuery) error {
				query.Result = fakeDash
				state.dashQueries = append(state.dashQueries, query)
				return nil
			})

			viewerRole := models.ROLE_VIEWER
			editorRole := models.ROLE_EDITOR

			aclMockResp := []*models.DashboardAclInfoDTO{
				{Role: &viewerRole, Permission: models.PERMISSION_VIEW},
				{Role: &editorRole, Permission: models.PERMISSION_EDIT},
			}

			bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
				query.Result = aclMockResp
				return nil
			})

			bus.AddHandler("test", func(query *models.GetTeamsByUserQuery) error {
				query.Result = []*models.TeamDTO{}
				return nil
			})

			return state
		}

		// This tests two scenarios:
		// 1. user is an org viewer
		// 2. user is an org editor

		t.Run("When user is an Org Viewer", func(t *testing.T) {
			role := models.ROLE_VIEWER

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					state := setUp()

					dash := getDashboardShouldReturn200(sc)

					assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)

					assert.False(t, dash.Meta.CanEdit)
					assert.False(t, dash.Meta.CanSave)
					assert.False(t, dash.Meta.CanAdmin)
				})

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					state := setUp()

					callDeleteDashboardBySlug(sc, &HTTPServer{
						Cfg:                   setting.NewCfg(),
						LibraryPanelService:   &mockLibraryPanelService{},
						LibraryElementService: &mockLibraryElementService{},
					})
					assert.Equal(t, 403, sc.resp.Code)

					assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
				})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1",
				"/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
					setUp()

					callGetDashboardVersion(sc)
					assert.Equal(t, 403, sc.resp.Code)
				})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions",
				"/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
					setUp()

					callGetDashboardVersions(sc)
					assert.Equal(t, 403, sc.resp.Code)
				})
		})

		t.Run("When user is an Org Editor", func(t *testing.T) {
			role := models.ROLE_EDITOR

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					state := setUp()

					dash := getDashboardShouldReturn200(sc)

					assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
					assert.True(t, dash.Meta.CanEdit)
					assert.True(t, dash.Meta.CanSave)
					assert.False(t, dash.Meta.CanAdmin)
				})

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					state := setUp()

					callDeleteDashboardBySlug(sc, &HTTPServer{
						Cfg:                   setting.NewCfg(),
						LibraryPanelService:   &mockLibraryPanelService{},
						LibraryElementService: &mockLibraryElementService{},
					})
					assert.Equal(t, 200, sc.resp.Code)
					assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
				})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1",
				"/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
					setUp()

					callGetDashboardVersion(sc)
					assert.Equal(t, 200, sc.resp.Code)
				})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions",
				"/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
					setUp()

					callGetDashboardVersions(sc)
					assert.Equal(t, 200, sc.resp.Code)
				})
		})
	})

	t.Run("Given a dashboard with a parent folder which has an ACL", func(t *testing.T) {
		hs := &HTTPServer{
			Cfg:                   setting.NewCfg(),
			Live:                  newTestLive(t),
			LibraryPanelService:   &mockLibraryPanelService{},
			LibraryElementService: &mockLibraryElementService{},
		}

		setUp := func() *testState {
			state := &testState{}

			fakeDash := models.NewDashboard("Child dash")
			fakeDash.Id = 1
			fakeDash.FolderId = 1
			fakeDash.HasAcl = true

			origCanEdit := setting.ViewersCanEdit
			t.Cleanup(func() {
				setting.ViewersCanEdit = origCanEdit
			})
			setting.ViewersCanEdit = false

			bus.AddHandler("test", func(query *models.GetDashboardsBySlugQuery) error {
				dashboards := []*models.Dashboard{fakeDash}
				query.Result = dashboards
				return nil
			})

			aclMockResp := []*models.DashboardAclInfoDTO{
				{
					DashboardId: 1,
					Permission:  models.PERMISSION_EDIT,
					UserId:      200,
				},
			}

			bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
				query.Result = aclMockResp
				return nil
			})

			bus.AddHandlerCtx("test", func(ctx context.Context, query *models.GetDashboardQuery) error {
				query.Result = fakeDash
				state.dashQueries = append(state.dashQueries, query)
				return nil
			})

			bus.AddHandler("test", func(query *models.GetTeamsByUserQuery) error {
				query.Result = []*models.TeamDTO{}
				return nil
			})

			return state
		}

		// This tests six scenarios:
		// 1. user is an org viewer AND has no permissions for this dashboard
		// 2. user is an org editor AND has no permissions for this dashboard
		// 3. user is an org viewer AND has been granted edit permission for the dashboard
		// 4. user is an org viewer AND all viewers have edit permission for this dashboard
		// 5. user is an org viewer AND has been granted an admin permission
		// 6. user is an org editor AND has been granted a view permission

		t.Run("When user is an Org Viewer and has no permissions for this dashboard", func(t *testing.T) {
			role := models.ROLE_VIEWER

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					state := setUp()

					sc.handlerFunc = hs.GetDashboard
					sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
					assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
					assert.Equal(t, 403, sc.resp.Code)
				})

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					state := setUp()

					callDeleteDashboardByUID(sc, hs)
					assert.Equal(t, 403, sc.resp.Code)
					assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
				})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1",
				"/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
					setUp()

					callGetDashboardVersion(sc)
					assert.Equal(t, 403, sc.resp.Code)
				})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions",
				"/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
					setUp()

					callGetDashboardVersions(sc)
					assert.Equal(t, 403, sc.resp.Code)
				})
		})

		t.Run("When user is an Org Editor and has no permissions for this dashboard", func(t *testing.T) {
			role := models.ROLE_EDITOR

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					state := setUp()

					sc.handlerFunc = hs.GetDashboard
					sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

					assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
					assert.Equal(t, 403, sc.resp.Code)
				})

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					state := setUp()

					callDeleteDashboardByUID(sc, hs)
					assert.Equal(t, 403, sc.resp.Code)
					assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
				})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1",
				"/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
					setUp()

					callGetDashboardVersion(sc)
					assert.Equal(t, 403, sc.resp.Code)
				})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions",
				"/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
					setUp()

					callGetDashboardVersions(sc)
					assert.Equal(t, 403, sc.resp.Code)
				})
		})

		t.Run("When user is an Org Viewer but has an edit permission", func(t *testing.T) {
			role := models.ROLE_VIEWER

			mockResult := []*models.DashboardAclInfoDTO{
				{OrgId: 1, DashboardId: 2, UserId: 1, Permission: models.PERMISSION_EDIT},
			}

			setUpInner := func() *testState {
				state := setUp()
				bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
					query.Result = mockResult
					return nil
				})
				return state
			}

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					state := setUpInner()

					dash := getDashboardShouldReturn200(sc)

					assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
					assert.True(t, dash.Meta.CanEdit)
					assert.True(t, dash.Meta.CanSave)
					assert.False(t, dash.Meta.CanAdmin)
				})

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				state := setUpInner()

				callDeleteDashboardByUID(sc, hs)
				assert.Equal(t, 200, sc.resp.Code)
				assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
			})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				setUpInner()

				callGetDashboardVersion(sc)
				assert.Equal(t, 200, sc.resp.Code)
			})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				setUpInner()

				callGetDashboardVersions(sc)
				assert.Equal(t, 200, sc.resp.Code)
			})
		})

		t.Run("When user is an Org Viewer and viewers can edit", func(t *testing.T) {
			role := models.ROLE_VIEWER

			setUpInner := func() *testState {
				state := setUp()

				mockResult := []*models.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, UserId: 1, Permission: models.PERMISSION_VIEW},
				}

				bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
					query.Result = mockResult
					return nil
				})

				origCanEdit := setting.ViewersCanEdit
				t.Cleanup(func() {
					setting.ViewersCanEdit = origCanEdit
				})
				setting.ViewersCanEdit = true

				return state
			}

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				state := setUpInner()

				require.True(t, setting.ViewersCanEdit)
				dash := getDashboardShouldReturn200(sc)

				assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
				assert.True(t, dash.Meta.CanEdit)
				assert.False(t, dash.Meta.CanSave)
				assert.False(t, dash.Meta.CanAdmin)
			})

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				state := setUpInner()

				callDeleteDashboardByUID(sc, hs)
				assert.Equal(t, 403, sc.resp.Code)
				assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
			})
		})

		t.Run("When user is an Org Viewer but has an admin permission", func(t *testing.T) {
			role := models.ROLE_VIEWER

			setUpInner := func() *testState {
				state := setUp()

				mockResult := []*models.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, UserId: 1, Permission: models.PERMISSION_ADMIN},
				}
				bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
					query.Result = mockResult
					return nil
				})
				return state
			}

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				state := setUpInner()

				dash := getDashboardShouldReturn200(sc)

				assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
				assert.True(t, dash.Meta.CanEdit)
				assert.True(t, dash.Meta.CanSave)
				assert.True(t, dash.Meta.CanAdmin)
			})

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				state := setUpInner()

				callDeleteDashboardByUID(sc, hs)
				assert.Equal(t, 200, sc.resp.Code)
				assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
			})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				setUpInner()

				callGetDashboardVersion(sc)
				assert.Equal(t, 200, sc.resp.Code)
			})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				setUpInner()

				callGetDashboardVersions(sc)
				assert.Equal(t, 200, sc.resp.Code)
			})
		})

		t.Run("When user is an Org Editor but has a view permission", func(t *testing.T) {
			role := models.ROLE_EDITOR

			setUpInner := func() *testState {
				state := setUp()

				mockResult := []*models.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, UserId: 1, Permission: models.PERMISSION_VIEW},
				}
				bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
					query.Result = mockResult
					return nil
				})
				return state
			}

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				state := setUpInner()

				dash := getDashboardShouldReturn200(sc)
				assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
				assert.False(t, dash.Meta.CanEdit)
				assert.False(t, dash.Meta.CanSave)
			})

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				state := setUpInner()

				callDeleteDashboardByUID(sc, hs)
				assert.Equal(t, 403, sc.resp.Code)
				assert.Equal(t, "abcdefghi", state.dashQueries[0].Uid)
			})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				setUpInner()

				callGetDashboardVersion(sc)
				assert.Equal(t, 403, sc.resp.Code)
			})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				setUpInner()

				callGetDashboardVersions(sc)
				assert.Equal(t, 403, sc.resp.Code)
			})
		})
	})

	t.Run("Given two dashboards with the same title in different folders", func(t *testing.T) {
		dashOne := models.NewDashboard("dash")
		dashOne.Id = 2
		dashOne.FolderId = 1
		dashOne.HasAcl = false

		dashTwo := models.NewDashboard("dash")
		dashTwo.Id = 4
		dashTwo.FolderId = 3
		dashTwo.HasAcl = false

		bus.AddHandler("test", func(query *models.GetDashboardsBySlugQuery) error {
			dashboards := []*models.Dashboard{dashOne, dashTwo}
			query.Result = dashboards
			return nil
		})
	})

	t.Run("Post dashboard response tests", func(t *testing.T) {
		// This tests that a valid request returns correct response
		t.Run("Given a correct request for creating a dashboard", func(t *testing.T) {
			const folderID int64 = 3
			const dashID int64 = 2

			cmd := models.SaveDashboardCommand{
				OrgId:  1,
				UserId: 5,
				Dashboard: simplejson.NewFromAny(map[string]interface{}{
					"title": "Dash",
				}),
				Overwrite: true,
				FolderId:  folderID,
				IsFolder:  false,
				Message:   "msg",
			}

			mock := &dashboards.FakeDashboardService{
				SaveDashboardResult: &models.Dashboard{
					Id:      dashID,
					Uid:     "uid",
					Title:   "Dash",
					Slug:    "dash",
					Version: 2,
				},
			}

			postDashboardScenario(t, "When calling POST on", "/api/dashboards", "/api/dashboards", mock, nil, cmd, func(sc *scenarioContext) {
				callPostDashboardShouldReturnSuccess(sc)

				dto := mock.SavedDashboards[0]
				assert.Equal(t, cmd.OrgId, dto.OrgId)
				assert.Equal(t, cmd.UserId, dto.User.UserId)
				assert.Equal(t, folderID, dto.Dashboard.FolderId)
				assert.Equal(t, "Dash", dto.Dashboard.Title)
				assert.True(t, dto.Overwrite)
				assert.Equal(t, "msg", dto.Message)

				result := sc.ToJSON()
				assert.Equal(t, "success", result.Get("status").MustString())
				assert.Equal(t, dashID, result.Get("id").MustInt64())
				assert.Equal(t, "uid", result.Get("uid").MustString())
				assert.Equal(t, "dash", result.Get("slug").MustString())
				assert.Equal(t, "/d/uid/dash", result.Get("url").MustString())
			})
		})

		t.Run("Given a correct request for creating a dashboard with folder uid", func(t *testing.T) {
			const folderUid string = "folderUID"
			const dashID int64 = 2

			cmd := models.SaveDashboardCommand{
				OrgId:  1,
				UserId: 5,
				Dashboard: simplejson.NewFromAny(map[string]interface{}{
					"title": "Dash",
				}),
				Overwrite: true,
				FolderUid: folderUid,
				IsFolder:  false,
				Message:   "msg",
			}

			mock := &dashboards.FakeDashboardService{
				SaveDashboardResult: &models.Dashboard{
					Id:      dashID,
					Uid:     "uid",
					Title:   "Dash",
					Slug:    "dash",
					Version: 2,
				},
			}

			mockFolder := &fakeFolderService{
				GetFolderByUIDResult: &models.Folder{Id: 1, Uid: "folderUID", Title: "Folder"},
			}

			postDashboardScenario(t, "When calling POST on", "/api/dashboards", "/api/dashboards", mock, mockFolder, cmd, func(sc *scenarioContext) {
				callPostDashboardShouldReturnSuccess(sc)

				dto := mock.SavedDashboards[0]
				assert.Equal(t, cmd.OrgId, dto.OrgId)
				assert.Equal(t, cmd.UserId, dto.User.UserId)
				assert.Equal(t, "Dash", dto.Dashboard.Title)
				assert.True(t, dto.Overwrite)
				assert.Equal(t, "msg", dto.Message)

				result := sc.ToJSON()
				assert.Equal(t, "success", result.Get("status").MustString())
				assert.Equal(t, dashID, result.Get("id").MustInt64())
				assert.Equal(t, "uid", result.Get("uid").MustString())
				assert.Equal(t, "dash", result.Get("slug").MustString())
				assert.Equal(t, "/d/uid/dash", result.Get("url").MustString())
			})
		})

		t.Run("Given a request with incorrect folder uid for creating a dashboard with", func(t *testing.T) {
			const folderUid string = "folderUID"
			const dashID int64 = 2

			cmd := models.SaveDashboardCommand{
				OrgId:  1,
				UserId: 5,
				Dashboard: simplejson.NewFromAny(map[string]interface{}{
					"title": "Dash",
				}),
				Overwrite: true,
				FolderUid: folderUid,
				IsFolder:  false,
				Message:   "msg",
			}

			mock := &dashboards.FakeDashboardService{
				SaveDashboardResult: &models.Dashboard{
					Id:      dashID,
					Uid:     "uid",
					Title:   "Dash",
					Slug:    "dash",
					Version: 2,
				},
			}

			mockFolder := &fakeFolderService{
				GetFolderByUIDError: errors.New("Error while searching Folder ID"),
			}

			postDashboardScenario(t, "When calling POST on", "/api/dashboards", "/api/dashboards", mock, mockFolder, cmd, func(sc *scenarioContext) {
				callPostDashboard(sc)
				assert.Equal(t, 500, sc.resp.Code)
			})
		})

		// This tests that invalid requests returns expected error responses
		t.Run("Given incorrect requests for creating a dashboard", func(t *testing.T) {
			testCases := []struct {
				SaveError          error
				ExpectedStatusCode int
			}{
				{SaveError: models.ErrDashboardNotFound, ExpectedStatusCode: 404},
				{SaveError: models.ErrFolderNotFound, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardWithSameUIDExists, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardWithSameNameInFolderExists, ExpectedStatusCode: 412},
				{SaveError: models.ErrDashboardVersionMismatch, ExpectedStatusCode: 412},
				{SaveError: models.ErrDashboardTitleEmpty, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardFolderCannotHaveParent, ExpectedStatusCode: 400},
				{SaveError: alerting.ValidationError{Reason: "Mu"}, ExpectedStatusCode: 422},
				{SaveError: models.ErrDashboardFailedGenerateUniqueUid, ExpectedStatusCode: 500},
				{SaveError: models.ErrDashboardTypeMismatch, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardFolderWithSameNameAsDashboard, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardWithSameNameAsFolder, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardFolderNameExists, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardUpdateAccessDenied, ExpectedStatusCode: 403},
				{SaveError: models.ErrDashboardInvalidUid, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardUidTooLong, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardCannotSaveProvisionedDashboard, ExpectedStatusCode: 400},
				{SaveError: models.UpdatePluginDashboardError{PluginId: "plug"}, ExpectedStatusCode: 412},
			}

			cmd := models.SaveDashboardCommand{
				OrgId: 1,
				Dashboard: simplejson.NewFromAny(map[string]interface{}{
					"title": "",
				}),
			}

			for _, tc := range testCases {
				mock := &dashboards.FakeDashboardService{
					SaveDashboardError: tc.SaveError,
				}

				postDashboardScenario(t, fmt.Sprintf("Expect '%s' error when calling POST on", tc.SaveError.Error()),
					"/api/dashboards", "/api/dashboards", mock, nil, cmd, func(sc *scenarioContext) {
						callPostDashboard(sc)
						assert.Equal(t, tc.ExpectedStatusCode, sc.resp.Code)
					})
			}
		})
	})

	t.Run("Given two dashboards being compared", func(t *testing.T) {
		setUp := func() {
			mockResult := []*models.DashboardAclInfoDTO{}
			bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
				query.Result = mockResult
				return nil
			})

			bus.AddHandler("test", func(query *models.GetDashboardVersionQuery) error {
				query.Result = &models.DashboardVersion{
					Data: simplejson.NewFromAny(map[string]interface{}{
						"title": fmt.Sprintf("Dash%d", query.DashboardId),
					}),
				}
				return nil
			})
		}

		cmd := dtos.CalculateDiffOptions{
			Base: dtos.CalculateDiffTarget{
				DashboardId: 1,
				Version:     1,
			},
			New: dtos.CalculateDiffTarget{
				DashboardId: 2,
				Version:     2,
			},
			DiffType: "basic",
		}

		t.Run("when user does not have permission", func(t *testing.T) {
			role := models.ROLE_VIEWER

			postDiffScenario(t, "When calling POST on", "/api/dashboards/calculate-diff", "/api/dashboards/calculate-diff", cmd, role, func(sc *scenarioContext) {
				setUp()

				callPostDashboard(sc)
				assert.Equal(t, 403, sc.resp.Code)
			})
		})

		t.Run("when user does have permission", func(t *testing.T) {
			role := models.ROLE_ADMIN

			postDiffScenario(t, "When calling POST on", "/api/dashboards/calculate-diff", "/api/dashboards/calculate-diff", cmd, role, func(sc *scenarioContext) {
				setUp()

				callPostDashboard(sc)
				assert.Equal(t, 200, sc.resp.Code)
			})
		})
	})

	t.Run("Given dashboard in folder being restored should restore to folder", func(t *testing.T) {
		const folderID int64 = 1
		setUp := func() {
			fakeDash := models.NewDashboard("Child dash")
			fakeDash.Id = 2
			fakeDash.FolderId = folderID
			fakeDash.HasAcl = false

			bus.AddHandlerCtx("test", func(ctx context.Context, query *models.GetDashboardQuery) error {
				query.Result = fakeDash
				return nil
			})

			bus.AddHandler("test", func(query *models.GetDashboardVersionQuery) error {
				query.Result = &models.DashboardVersion{
					DashboardId: 2,
					Version:     1,
					Data:        fakeDash.Data,
				}
				return nil
			})
		}

		mock := &dashboards.FakeDashboardService{
			SaveDashboardResult: &models.Dashboard{
				Id:      2,
				Uid:     "uid",
				Title:   "Dash",
				Slug:    "dash",
				Version: 1,
			},
		}

		cmd := dtos.RestoreDashboardVersionCommand{
			Version: 1,
		}

		restoreDashboardVersionScenario(t, "When calling POST on", "/api/dashboards/id/1/restore",
			"/api/dashboards/id/:dashboardId/restore", mock, cmd, func(sc *scenarioContext) {
				setUp()

				callRestoreDashboardVersion(sc)
				assert.Equal(t, 200, sc.resp.Code)
				dto := mock.SavedDashboards[0]
				assert.Equal(t, folderID, dto.Dashboard.FolderId)
				assert.Equal(t, "Child dash", dto.Dashboard.Title)
				assert.Equal(t, "Restored from version 1", dto.Message)
			})
	})

	t.Run("Given dashboard in general folder being restored should restore to general folder", func(t *testing.T) {
		setUp := func() {
			fakeDash := models.NewDashboard("Child dash")
			fakeDash.Id = 2
			fakeDash.HasAcl = false

			bus.AddHandlerCtx("test", func(ctx context.Context, query *models.GetDashboardQuery) error {
				query.Result = fakeDash
				return nil
			})

			bus.AddHandler("test", func(query *models.GetDashboardVersionQuery) error {
				query.Result = &models.DashboardVersion{
					DashboardId: 2,
					Version:     1,
					Data:        fakeDash.Data,
				}
				return nil
			})
		}

		mock := &dashboards.FakeDashboardService{
			SaveDashboardResult: &models.Dashboard{
				Id:      2,
				Uid:     "uid",
				Title:   "Dash",
				Slug:    "dash",
				Version: 1,
			},
		}

		cmd := dtos.RestoreDashboardVersionCommand{
			Version: 1,
		}

		restoreDashboardVersionScenario(t, "When calling POST on", "/api/dashboards/id/1/restore",
			"/api/dashboards/id/:dashboardId/restore", mock, cmd, func(sc *scenarioContext) {
				setUp()

				callRestoreDashboardVersion(sc)
				assert.Equal(t, 200, sc.resp.Code)
				dto := mock.SavedDashboards[0]
				assert.Equal(t, int64(0), dto.Dashboard.FolderId)
				assert.Equal(t, "Child dash", dto.Dashboard.Title)
				assert.Equal(t, "Restored from version 1", dto.Message)
			})
	})

	t.Run("Given provisioned dashboard", func(t *testing.T) {
		setUp := func() {
			bus.AddHandler("test", func(query *models.GetDashboardsBySlugQuery) error {
				query.Result = []*models.Dashboard{{}}
				return nil
			})
			bus.AddHandlerCtx("test", func(ctx context.Context, query *models.GetDashboardQuery) error {
				dataValue, err := simplejson.NewJson([]byte(`{"id": 1, "editable": true, "style": "dark"}`))
				require.NoError(t, err)
				query.Result = &models.Dashboard{Id: 1, Data: dataValue}
				return nil
			})

			origGetProvisionedData := dashboards.GetProvisionedData
			t.Cleanup(func() {
				dashboards.GetProvisionedData = origGetProvisionedData
			})
			dashboards.GetProvisionedData = func(dboards.Store, int64) (*models.DashboardProvisioning, error) {
				return &models.DashboardProvisioning{ExternalId: "/tmp/grafana/dashboards/test/dashboard1.json"}, nil
			}

			bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
				query.Result = []*models.DashboardAclInfoDTO{
					{OrgId: testOrgID, DashboardId: 1, UserId: testUserID, Permission: models.PERMISSION_EDIT},
				}
				return nil
			})
		}

		loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/db/abcdefghi", "/api/dashboards/db/:uid", models.ROLE_EDITOR, func(sc *scenarioContext) {
			setUp()

			callDeleteDashboardBySlug(sc, &HTTPServer{
				Cfg:                   setting.NewCfg(),
				LibraryPanelService:   &mockLibraryPanelService{},
				LibraryElementService: &mockLibraryElementService{},
			})

			assert.Equal(t, 400, sc.resp.Code)
			result := sc.ToJSON()
			assert.Equal(t, models.ErrDashboardCannotDeleteProvisionedDashboard.Error(), result.Get("error").MustString())
		})

		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/dash", "/api/dashboards/uid/:uid", models.ROLE_EDITOR, func(sc *scenarioContext) {
			setUp()

			mock := provisioning.NewProvisioningServiceMock()
			mock.GetDashboardProvisionerResolvedPathFunc = func(name string) string {
				return "/tmp/grafana/dashboards"
			}

			dash := getDashboardShouldReturn200WithConfig(sc, mock)

			assert.Equal(t, filepath.Join("test", "dashboard1.json"), dash.Meta.ProvisionedExternalId)
		})

		loggedInUserScenarioWithRole(t, "When allowUiUpdates is true and calling GET on", "GET", "/api/dashboards/uid/dash", "/api/dashboards/uid/:uid", models.ROLE_EDITOR, func(sc *scenarioContext) {
			setUp()

			mock := provisioning.NewProvisioningServiceMock()
			mock.GetDashboardProvisionerResolvedPathFunc = func(name string) string {
				return "/tmp/grafana/dashboards"
			}
			mock.GetAllowUIUpdatesFromConfigFunc = func(name string) bool {
				return true
			}

			hs := &HTTPServer{
				Cfg:                   setting.NewCfg(),
				ProvisioningService:   mock,
				LibraryPanelService:   &mockLibraryPanelService{},
				LibraryElementService: &mockLibraryElementService{},
			}
			callGetDashboard(sc, hs)

			assert.Equal(t, 200, sc.resp.Code)

			dash := dtos.DashboardFullWithMeta{}
			err := json.NewDecoder(sc.resp.Body).Decode(&dash)
			require.NoError(t, err)

			assert.Equal(t, false, dash.Meta.Provisioned)
		})
	})
}

func getDashboardShouldReturn200WithConfig(sc *scenarioContext, provisioningService provisioning.ProvisioningService) dtos.
	DashboardFullWithMeta {
	if provisioningService == nil {
		provisioningService = provisioning.NewProvisioningServiceMock()
	}

	libraryPanelsService := mockLibraryPanelService{}
	libraryElementsService := mockLibraryElementService{}

	hs := &HTTPServer{
		Cfg:                   setting.NewCfg(),
		LibraryPanelService:   &libraryPanelsService,
		LibraryElementService: &libraryElementsService,
		ProvisioningService:   provisioningService,
	}

	callGetDashboard(sc, hs)

	require.Equal(sc.t, 200, sc.resp.Code)

	dash := dtos.DashboardFullWithMeta{}
	err := json.NewDecoder(sc.resp.Body).Decode(&dash)
	require.NoError(sc.t, err)

	return dash
}

func getDashboardShouldReturn200(sc *scenarioContext) dtos.DashboardFullWithMeta {
	return getDashboardShouldReturn200WithConfig(sc, nil)
}

func callGetDashboard(sc *scenarioContext, hs *HTTPServer) {
	sc.handlerFunc = hs.GetDashboard
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func callGetDashboardVersion(sc *scenarioContext) {
	bus.AddHandler("test", func(query *models.GetDashboardVersionQuery) error {
		query.Result = &models.DashboardVersion{}
		return nil
	})

	sc.handlerFunc = GetDashboardVersion
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func callGetDashboardVersions(sc *scenarioContext) {
	bus.AddHandler("test", func(query *models.GetDashboardVersionsQuery) error {
		query.Result = []*models.DashboardVersionDTO{}
		return nil
	})

	sc.handlerFunc = GetDashboardVersions
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func callDeleteDashboardBySlug(sc *scenarioContext, hs *HTTPServer) {
	bus.AddHandler("test", func(cmd *models.DeleteDashboardCommand) error {
		return nil
	})

	sc.handlerFunc = hs.DeleteDashboardBySlug
	sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
}

func callDeleteDashboardByUID(sc *scenarioContext, hs *HTTPServer) {
	bus.AddHandler("test", func(cmd *models.DeleteDashboardCommand) error {
		return nil
	})

	sc.handlerFunc = hs.DeleteDashboardByUID
	sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
}

func callPostDashboard(sc *scenarioContext) {
	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func callRestoreDashboardVersion(sc *scenarioContext) {
	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func callPostDashboardShouldReturnSuccess(sc *scenarioContext) {
	callPostDashboard(sc)

	assert.Equal(sc.t, 200, sc.resp.Code)
}

func postDashboardScenario(t *testing.T, desc string, url string, routePattern string,
	mock *dashboards.FakeDashboardService, mockFolder *fakeFolderService, cmd models.SaveDashboardCommand,
	fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		t.Cleanup(bus.ClearBusHandlers)

		cfg := setting.NewCfg()
		hs := HTTPServer{
			Bus:                 bus.GetBus(),
			Cfg:                 cfg,
			ProvisioningService: provisioning.NewProvisioningServiceMock(),
			Live:                newTestLive(t),
			QuotaService: &quota.QuotaService{
				Cfg: cfg,
			},
			PluginManager:         &fakePluginManager{},
			LibraryPanelService:   &mockLibraryPanelService{},
			LibraryElementService: &mockLibraryElementService{},
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{OrgId: cmd.OrgId, UserId: cmd.UserId}

			return hs.PostDashboard(c, cmd)
		})

		origNewDashboardService := dashboards.NewService
		origProvisioningService := dashboards.NewProvisioningService
		origNewFolderService := dashboards.NewFolderService
		t.Cleanup(func() {
			dashboards.NewService = origNewDashboardService
			dashboards.NewProvisioningService = origProvisioningService
			dashboards.NewFolderService = origNewFolderService
		})
		dashboards.MockDashboardService(mock)
		dashboards.NewProvisioningService = func(dboards.Store) dashboards.DashboardProvisioningService {
			return mockDashboardProvisioningService{}
		}
		mockFolderService(mockFolder)

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func postDiffScenario(t *testing.T, desc string, url string, routePattern string, cmd dtos.CalculateDiffOptions, role models.RoleType, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{
				OrgId:  testOrgID,
				UserId: testUserID,
			}
			sc.context.OrgRole = role

			return CalculateDashboardDiff(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func restoreDashboardVersionScenario(t *testing.T, desc string, url string, routePattern string,
	mock *dashboards.FakeDashboardService, cmd dtos.RestoreDashboardVersionCommand, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		cfg := setting.NewCfg()
		hs := HTTPServer{
			Cfg:                   cfg,
			Bus:                   bus.GetBus(),
			ProvisioningService:   provisioning.NewProvisioningServiceMock(),
			Live:                  newTestLive(t),
			QuotaService:          &quota.QuotaService{Cfg: cfg},
			LibraryPanelService:   &mockLibraryPanelService{},
			LibraryElementService: &mockLibraryElementService{},
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{
				OrgId:  testOrgID,
				UserId: testUserID,
			}
			sc.context.OrgRole = models.ROLE_ADMIN

			return hs.RestoreDashboardVersion(c, cmd)
		})

		origProvisioningService := dashboards.NewProvisioningService
		origNewDashboardService := dashboards.NewService
		t.Cleanup(func() {
			dashboards.NewService = origNewDashboardService
			dashboards.NewProvisioningService = origProvisioningService
		})
		dashboards.NewProvisioningService = func(dboards.Store) dashboards.DashboardProvisioningService {
			return mockDashboardProvisioningService{}
		}
		dashboards.MockDashboardService(mock)

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func (sc *scenarioContext) ToJSON() *simplejson.Json {
	var result *simplejson.Json
	err := json.NewDecoder(sc.resp.Body).Decode(&result)
	require.NoError(sc.t, err)
	return result
}

type mockDashboardProvisioningService struct {
	dashboards.DashboardProvisioningService
}

func (s mockDashboardProvisioningService) GetProvisionedDashboardDataByDashboardID(dashboardID int64) (
	*models.DashboardProvisioning, error) {
	return nil, nil
}

type mockLibraryPanelService struct {
}

func (m *mockLibraryPanelService) LoadLibraryPanelsForDashboard(c *models.ReqContext, dash *models.Dashboard) error {
	return nil
}

func (m *mockLibraryPanelService) CleanLibraryPanelsForDashboard(dash *models.Dashboard) error {
	return nil
}

func (m *mockLibraryPanelService) ConnectLibraryPanelsForDashboard(c *models.ReqContext, dash *models.Dashboard) error {
	return nil
}

type mockLibraryElementService struct {
}

func (l *mockLibraryElementService) CreateElement(c *models.ReqContext, cmd libraryelements.CreateLibraryElementCommand) (libraryelements.LibraryElementDTO, error) {
	return libraryelements.LibraryElementDTO{}, nil
}

// GetElementsForDashboard gets all connected elements for a specific dashboard.
func (l *mockLibraryElementService) GetElementsForDashboard(c *models.ReqContext, dashboardID int64) (map[string]libraryelements.LibraryElementDTO, error) {
	return map[string]libraryelements.LibraryElementDTO{}, nil
}

// ConnectElementsToDashboard connects elements to a specific dashboard.
func (l *mockLibraryElementService) ConnectElementsToDashboard(c *models.ReqContext, elementUIDs []string, dashboardID int64) error {
	return nil
}

// DisconnectElementsFromDashboard disconnects elements from a specific dashboard.
func (l *mockLibraryElementService) DisconnectElementsFromDashboard(c *models.ReqContext, dashboardID int64) error {
	return nil
}

// DeleteLibraryElementsInFolder deletes all elements for a specific folder.
func (l *mockLibraryElementService) DeleteLibraryElementsInFolder(c *models.ReqContext, folderUID string) error {
	return nil
}

package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/coremodel/dashboard"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/framework/coremodel"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/live"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestGetHomeDashboard(t *testing.T) {
	httpReq, err := http.NewRequest(http.MethodGet, "", nil)
	require.NoError(t, err)
	httpReq.Header.Add("Content-Type", "application/json")
	req := &models.ReqContext{SignedInUser: &models.SignedInUser{}, Context: &web.Context{Req: httpReq}}
	cfg := setting.NewCfg()
	cfg.StaticRootPath = "../../public/"
	prefService := preftest.NewPreferenceServiceFake()

	hs := &HTTPServer{
		Cfg:               cfg,
		pluginStore:       &fakePluginStore{},
		SQLStore:          mockstore.NewSQLStoreMock(),
		CoremodelRegistry: setupDashboardCoremodel(t),
		preferenceService: prefService,
	}

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

			prefService.ExpectedPreference = &pref.Preference{}

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

func newTestLive(t *testing.T, store *sqlstore.SQLStore) *live.GrafanaLive {
	features := featuremgmt.WithFeatures()
	cfg := &setting.Cfg{AppURL: "http://localhost:3000/"}
	cfg.IsFeatureToggleEnabled = features.IsEnabled
	gLive, err := live.ProvideService(nil, cfg,
		routing.NewRouteRegister(),
		nil, nil, nil,
		store,
		nil,
		&usagestats.UsageStatsMock{T: t},
		nil,
		features, accesscontrolmock.New(), &dashboards.FakeDashboardService{})
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
		fakeDash := models.NewDashboard("Child dash")
		fakeDash.Id = 1
		fakeDash.FolderId = 1
		fakeDash.HasAcl = false
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*models.GetDashboardQuery)
			q.Result = fakeDash
		}).Return(nil)

		mockSQLStore := mockstore.NewSQLStoreMock()

		hs := &HTTPServer{
			Cfg:               setting.NewCfg(),
			pluginStore:       &fakePluginStore{},
			SQLStore:          mockSQLStore,
			CoremodelRegistry: setupDashboardCoremodel(t),
			AccessControl:     accesscontrolmock.New(),
			Features:          featuremgmt.WithFeatures(),
			dashboardService:  dashboardService,
		}

		setUp := func() {
			viewerRole := models.ROLE_VIEWER
			editorRole := models.ROLE_EDITOR

			aclMockResp := []*models.DashboardAclInfoDTO{
				{Role: &viewerRole, Permission: models.PERMISSION_VIEW},
				{Role: &editorRole, Permission: models.PERMISSION_EDIT},
			}
			mockSQLStore.ExpectedDashboardAclInfoList = aclMockResp
			guardian.InitLegacyGuardian(mockSQLStore)
		}

		// This tests two scenarios:
		// 1. user is an org viewer
		// 2. user is an org editor

		t.Run("When user is an Org Viewer", func(t *testing.T) {
			role := models.ROLE_VIEWER
			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					setUp()
					sc.sqlStore = mockSQLStore
					dash := getDashboardShouldReturn200WithConfig(t, sc, nil, nil, dashboardService)

					assert.False(t, dash.Meta.CanEdit)
					assert.False(t, dash.Meta.CanSave)
					assert.False(t, dash.Meta.CanAdmin)
				}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1",
				"/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
					setUp()
					sc.sqlStore = mockSQLStore

					hs.callGetDashboardVersion(sc)
					assert.Equal(t, 403, sc.resp.Code)
				}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions",
				"/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
					setUp()
					sc.sqlStore = mockSQLStore

					hs.callGetDashboardVersions(sc)
					assert.Equal(t, 403, sc.resp.Code)
				}, mockSQLStore)
		})

		t.Run("When user is an Org Editor", func(t *testing.T) {
			role := models.ROLE_EDITOR
			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					setUp()
					sc.sqlStore = mockSQLStore
					dash := getDashboardShouldReturn200WithConfig(t, sc, nil, nil, dashboardService)

					assert.True(t, dash.Meta.CanEdit)
					assert.True(t, dash.Meta.CanSave)
					assert.False(t, dash.Meta.CanAdmin)
				}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1",
				"/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
					setUp()
					sc.sqlStore = mockSQLStore
					hs.callGetDashboardVersion(sc)

					assert.Equal(t, 200, sc.resp.Code)
				}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions",
				"/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
					setUp()
					hs.callGetDashboardVersions(sc)

					assert.Equal(t, 200, sc.resp.Code)
				}, mockSQLStore)
		})
	})

	t.Run("Given a dashboard with a parent folder which has an ACL", func(t *testing.T) {
		fakeDash := models.NewDashboard("Child dash")
		fakeDash.Id = 1
		fakeDash.FolderId = 1
		fakeDash.HasAcl = true
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*models.GetDashboardQuery)
			q.Result = fakeDash
		}).Return(nil)

		mockSQLStore := mockstore.NewSQLStoreMock()
		cfg := setting.NewCfg()
		sql := sqlstore.InitTestDB(t)

		hs := &HTTPServer{
			Cfg:                   cfg,
			Live:                  newTestLive(t, sql),
			LibraryPanelService:   &mockLibraryPanelService{},
			LibraryElementService: &mockLibraryElementService{},
			CoremodelRegistry:     setupDashboardCoremodel(t),
			SQLStore:              mockSQLStore,
			AccessControl:         accesscontrolmock.New(),
			dashboardService:      dashboardService,
		}

		setUp := func() {
			origCanEdit := setting.ViewersCanEdit
			t.Cleanup(func() {
				setting.ViewersCanEdit = origCanEdit
			})
			setting.ViewersCanEdit = false

			aclMockResp := []*models.DashboardAclInfoDTO{
				{
					DashboardId: 1,
					Permission:  models.PERMISSION_EDIT,
					UserId:      200,
				},
			}

			mockSQLStore.ExpectedDashboardAclInfoList = aclMockResp
			guardian.InitLegacyGuardian(mockSQLStore)
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
					setUp()
					sc.sqlStore = mockSQLStore
					sc.handlerFunc = hs.GetDashboard
					sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

					assert.Equal(t, 403, sc.resp.Code)
				}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					setUp()
					sc.sqlStore = mockSQLStore
					hs.callDeleteDashboardByUID(t, sc, dashboardService)

					assert.Equal(t, 403, sc.resp.Code)
				}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1",
				"/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
					setUp()
					sc.sqlStore = mockSQLStore
					hs.callGetDashboardVersion(sc)

					assert.Equal(t, 403, sc.resp.Code)
				}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions",
				"/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
					setUp()
					hs.callGetDashboardVersions(sc)

					assert.Equal(t, 403, sc.resp.Code)
				}, mockSQLStore)
		})

		t.Run("When user is an Org Editor and has no permissions for this dashboard", func(t *testing.T) {
			role := models.ROLE_EDITOR
			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					setUp()
					sc.sqlStore = mockSQLStore
					sc.handlerFunc = hs.GetDashboard
					sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

					assert.Equal(t, 403, sc.resp.Code)
				}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					setUp()
					hs.callDeleteDashboardByUID(t, sc, dashboardService)

					assert.Equal(t, 403, sc.resp.Code)
				}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1",
				"/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
					setUp()
					hs.callGetDashboardVersion(sc)

					assert.Equal(t, 403, sc.resp.Code)
				}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions",
				"/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
					setUp()
					hs.callGetDashboardVersions(sc)

					assert.Equal(t, 403, sc.resp.Code)
				}, mockSQLStore)
		})

		t.Run("When user is an Org Viewer but has an edit permission", func(t *testing.T) {
			role := models.ROLE_VIEWER

			mockResult := []*models.DashboardAclInfoDTO{
				{OrgId: 1, DashboardId: 2, UserId: 1, Permission: models.PERMISSION_EDIT},
			}

			setUpInner := func() {
				setUp()
				mockSQLStore.ExpectedDashboardAclInfoList = mockResult
			}

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi",
				"/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
					setUpInner()
					sc.sqlStore = mockSQLStore
					dash := getDashboardShouldReturn200WithConfig(t, sc, nil, nil, dashboardService)

					assert.True(t, dash.Meta.CanEdit)
					assert.True(t, dash.Meta.CanSave)
					assert.False(t, dash.Meta.CanAdmin)
				}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				setUpInner()
				dashboardService := dashboards.NewFakeDashboardService(t)
				dashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
					q := args.Get(1).(*models.GetDashboardQuery)
					q.Result = models.NewDashboard("test")
				}).Return(nil)
				dashboardService.On("DeleteDashboard", mock.Anything, mock.AnythingOfType("int64"), mock.AnythingOfType("int64")).Return(nil)

				hs.callDeleteDashboardByUID(t, sc, dashboardService)

				assert.Equal(t, 200, sc.resp.Code)
			}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				setUpInner()
				sc.sqlStore = mockSQLStore
				hs.callGetDashboardVersion(sc)

				assert.Equal(t, 200, sc.resp.Code)
			}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				setUpInner()
				hs.callGetDashboardVersions(sc)

				assert.Equal(t, 200, sc.resp.Code)
			}, mockSQLStore)
		})

		t.Run("When user is an Org Viewer and viewers can edit", func(t *testing.T) {
			role := models.ROLE_VIEWER

			setUpInner := func() {
				setUp()

				mockResult := []*models.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, UserId: 1, Permission: models.PERMISSION_VIEW},
				}
				mockSQLStore.ExpectedDashboardAclInfoList = mockResult

				origCanEdit := setting.ViewersCanEdit
				t.Cleanup(func() {
					setting.ViewersCanEdit = origCanEdit
				})
				setting.ViewersCanEdit = true
			}

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				setUpInner()

				require.True(t, setting.ViewersCanEdit)
				sc.sqlStore = mockSQLStore
				dash := getDashboardShouldReturn200WithConfig(t, sc, nil, nil, dashboardService)

				assert.True(t, dash.Meta.CanEdit)
				assert.False(t, dash.Meta.CanSave)
				assert.False(t, dash.Meta.CanAdmin)
			}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				setUpInner()

				hs.callDeleteDashboardByUID(t, sc, dashboardService)
				assert.Equal(t, 403, sc.resp.Code)
			}, mockSQLStore)
		})

		t.Run("When user is an Org Viewer but has an admin permission", func(t *testing.T) {
			role := models.ROLE_VIEWER

			setUpInner := func() {
				setUp()

				mockResult := []*models.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, UserId: 1, Permission: models.PERMISSION_ADMIN},
				}
				mockSQLStore.ExpectedDashboardAclInfoList = mockResult
			}

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				setUpInner()
				sc.sqlStore = mockSQLStore
				dash := getDashboardShouldReturn200WithConfig(t, sc, nil, nil, dashboardService)

				assert.True(t, dash.Meta.CanEdit)
				assert.True(t, dash.Meta.CanSave)
				assert.True(t, dash.Meta.CanAdmin)
			}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				setUpInner()
				sc.sqlStore = mockSQLStore
				dashboardService := dashboards.NewFakeDashboardService(t)
				dashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
					q := args.Get(1).(*models.GetDashboardQuery)
					q.Result = models.NewDashboard("test")
				}).Return(nil)
				dashboardService.On("DeleteDashboard", mock.Anything, mock.AnythingOfType("int64"), mock.AnythingOfType("int64")).Return(nil)
				hs.callDeleteDashboardByUID(t, sc, dashboardService)

				assert.Equal(t, 200, sc.resp.Code)
			}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				setUpInner()

				hs.callGetDashboardVersion(sc)
				assert.Equal(t, 200, sc.resp.Code)
			}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				setUpInner()

				hs.callGetDashboardVersions(sc)
				assert.Equal(t, 200, sc.resp.Code)
			}, mockSQLStore)
		})

		t.Run("When user is an Org Editor but has a view permission", func(t *testing.T) {
			role := models.ROLE_EDITOR

			setUpInner := func() {
				setUp()

				mockResult := []*models.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, UserId: 1, Permission: models.PERMISSION_VIEW},
				}
				mockSQLStore.ExpectedDashboardAclInfoList = mockResult
			}

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				setUpInner()
				sc.sqlStore = mockSQLStore
				dash := getDashboardShouldReturn200WithConfig(t, sc, nil, nil, dashboardService)

				assert.False(t, dash.Meta.CanEdit)
				assert.False(t, dash.Meta.CanSave)
			}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				setUpInner()
				hs.callDeleteDashboardByUID(t, sc, dashboardService)

				assert.Equal(t, 403, sc.resp.Code)
			}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				setUpInner()
				hs.callGetDashboardVersion(sc)

				assert.Equal(t, 403, sc.resp.Code)
			}, mockSQLStore)

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				setUpInner()
				hs.callGetDashboardVersions(sc)

				assert.Equal(t, 403, sc.resp.Code)
			}, mockSQLStore)
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
	})

	t.Run("Post dashboard response tests", func(t *testing.T) {
		dashboardStore := &dashboards.FakeDashboardStore{}
		defer dashboardStore.AssertExpectations(t)
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

			dashboardService := dashboards.NewFakeDashboardService(t)
			dashboardService.On("SaveDashboard", mock.Anything, mock.AnythingOfType("*dashboards.SaveDashboardDTO"), mock.AnythingOfType("bool")).
				Return(&models.Dashboard{Id: dashID, Uid: "uid", Title: "Dash", Slug: "dash", Version: 2}, nil)

			postDashboardScenario(t, "When calling POST on", "/api/dashboards", "/api/dashboards", cmd, dashboardService, nil, func(sc *scenarioContext) {
				callPostDashboardShouldReturnSuccess(sc)

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

			dashboardService := dashboards.NewFakeDashboardService(t)
			dashboardService.On("SaveDashboard", mock.Anything, mock.AnythingOfType("*dashboards.SaveDashboardDTO"), mock.AnythingOfType("bool")).
				Return(&models.Dashboard{Id: dashID, Uid: "uid", Title: "Dash", Slug: "dash", Version: 2}, nil)

			mockFolder := &fakeFolderService{
				GetFolderByUIDResult: &models.Folder{Id: 1, Uid: "folderUID", Title: "Folder"},
			}

			postDashboardScenario(t, "When calling POST on", "/api/dashboards", "/api/dashboards", cmd, dashboardService, mockFolder, func(sc *scenarioContext) {
				callPostDashboardShouldReturnSuccess(sc)

				result := sc.ToJSON()
				assert.Equal(t, "success", result.Get("status").MustString())
				assert.Equal(t, dashID, result.Get("id").MustInt64())
				assert.Equal(t, "uid", result.Get("uid").MustString())
				assert.Equal(t, "dash", result.Get("slug").MustString())
				assert.Equal(t, "/d/uid/dash", result.Get("url").MustString())
			})
		})

		t.Run("Given a request with incorrect folder uid for creating a dashboard with", func(t *testing.T) {
			cmd := models.SaveDashboardCommand{
				OrgId:  1,
				UserId: 5,
				Dashboard: simplejson.NewFromAny(map[string]interface{}{
					"title": "Dash",
				}),
				Overwrite: true,
				FolderUid: "folderUID",
				IsFolder:  false,
				Message:   "msg",
			}

			dashboardService := dashboards.NewFakeDashboardService(t)

			mockFolder := &fakeFolderService{
				GetFolderByUIDError: errors.New("Error while searching Folder ID"),
			}

			postDashboardScenario(t, "When calling POST on", "/api/dashboards", "/api/dashboards", cmd, dashboardService, mockFolder, func(sc *scenarioContext) {
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
				dashboardService := dashboards.NewFakeDashboardService(t)
				dashboardService.On("SaveDashboard", mock.Anything, mock.AnythingOfType("*dashboards.SaveDashboardDTO"), mock.AnythingOfType("bool")).Return(nil, tc.SaveError)

				postDashboardScenario(t, fmt.Sprintf("Expect '%s' error when calling POST on", tc.SaveError.Error()),
					"/api/dashboards", "/api/dashboards", cmd, dashboardService, nil, func(sc *scenarioContext) {
						callPostDashboard(sc)
						assert.Equal(t, tc.ExpectedStatusCode, sc.resp.Code)
					})
			}
		})
	})

	t.Run("Given two dashboards being compared", func(t *testing.T) {
		dashboardvs := []*models.DashboardVersion{
			{
				DashboardId: 1,
				Version:     1,
				Data: simplejson.NewFromAny(map[string]interface{}{
					"title": "Dash1",
				})},
			{
				DashboardId: 2,
				Version:     2,
				Data: simplejson.NewFromAny(map[string]interface{}{
					"title": "Dash2",
				})},
		}
		sqlmock := mockstore.SQLStoreMock{ExpectedDashboardVersions: dashboardvs}
		setUp := func() {
			mockResult := []*models.DashboardAclInfoDTO{}
			sqlmock.ExpectedDashboardAclInfoList = mockResult
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
			}, &sqlmock)
		})

		t.Run("when user does have permission", func(t *testing.T) {
			role := models.ROLE_ADMIN

			postDiffScenario(t, "When calling POST on", "/api/dashboards/calculate-diff", "/api/dashboards/calculate-diff", cmd, role, func(sc *scenarioContext) {
				setUp()

				callPostDashboard(sc)
				assert.Equal(t, 200, sc.resp.Code)
			}, &sqlmock)
		})
	})

	t.Run("Given dashboard in folder being restored should restore to folder", func(t *testing.T) {
		const folderID int64 = 1
		fakeDash := models.NewDashboard("Child dash")
		fakeDash.Id = 2
		fakeDash.FolderId = folderID
		fakeDash.HasAcl = false

		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*models.GetDashboardQuery)
			q.Result = fakeDash
		}).Return(nil)
		dashboardService.On("SaveDashboard", mock.Anything, mock.AnythingOfType("*dashboards.SaveDashboardDTO"), mock.AnythingOfType("bool")).Run(func(args mock.Arguments) {
			cmd := args.Get(1).(*dashboards.SaveDashboardDTO)
			cmd.Dashboard = &models.Dashboard{
				Id: 2, Uid: "uid", Title: "Dash", Slug: "dash", Version: 1,
			}
		}).Return(nil, nil)

		cmd := dtos.RestoreDashboardVersionCommand{
			Version: 1,
		}
		mockSQLStore := mockstore.NewSQLStoreMock()
		mockSQLStore.ExpectedDashboardVersions = []*models.DashboardVersion{
			{
				DashboardId: 2,
				Version:     1,
				Data:        fakeDash.Data,
			}}

		restoreDashboardVersionScenario(t, "When calling POST on", "/api/dashboards/id/1/restore",
			"/api/dashboards/id/:dashboardId/restore", dashboardService, cmd, func(sc *scenarioContext) {
				callRestoreDashboardVersion(sc)
				assert.Equal(t, 200, sc.resp.Code)
			}, mockSQLStore)
	})

	t.Run("Given dashboard in general folder being restored should restore to general folder", func(t *testing.T) {
		fakeDash := models.NewDashboard("Child dash")
		fakeDash.Id = 2
		fakeDash.HasAcl = false

		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*models.GetDashboardQuery)
			q.Result = fakeDash
		}).Return(nil)
		dashboardService.On("SaveDashboard", mock.Anything, mock.AnythingOfType("*dashboards.SaveDashboardDTO"), mock.AnythingOfType("bool")).Run(func(args mock.Arguments) {
			cmd := args.Get(1).(*dashboards.SaveDashboardDTO)
			cmd.Dashboard = &models.Dashboard{
				Id: 2, Uid: "uid", Title: "Dash", Slug: "dash", Version: 1,
			}
		}).Return(nil, nil)

		cmd := dtos.RestoreDashboardVersionCommand{
			Version: 1,
		}
		mockSQLStore := mockstore.NewSQLStoreMock()
		mockSQLStore.ExpectedDashboardVersions = []*models.DashboardVersion{
			{
				DashboardId: 2,
				Version:     1,
				Data:        fakeDash.Data,
			}}
		restoreDashboardVersionScenario(t, "When calling POST on", "/api/dashboards/id/1/restore",
			"/api/dashboards/id/:dashboardId/restore", dashboardService, cmd, func(sc *scenarioContext) {
				callRestoreDashboardVersion(sc)
				assert.Equal(t, 200, sc.resp.Code)
			}, mockSQLStore)
	})

	t.Run("Given provisioned dashboard", func(t *testing.T) {
		mockSQLStore := mockstore.NewSQLStoreMock()
		setUp := func() {
			mockSQLStore.ExpectedDashboardAclInfoList = []*models.DashboardAclInfoDTO{
				{OrgId: testOrgID, DashboardId: 1, UserId: testUserID, Permission: models.PERMISSION_EDIT},
			}
		}

		dataValue, err := simplejson.NewJson([]byte(`{"id": 1, "editable": true, "style": "dark"}`))
		require.NoError(t, err)

		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*models.GetDashboardQuery)
			q.Result = &models.Dashboard{Id: 1, Data: dataValue}
		}).Return(nil)

		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/uid/dash", "/api/dashboards/uid/:uid", models.ROLE_EDITOR, func(sc *scenarioContext) {
			setUp()
			fakeProvisioningService := provisioning.NewProvisioningServiceMock(context.Background())
			fakeProvisioningService.GetDashboardProvisionerResolvedPathFunc = func(name string) string {
				return "/tmp/grafana/dashboards"
			}

			dashboardStore := &dashboards.FakeDashboardStore{}
			defer dashboardStore.AssertExpectations(t)

			dashboardStore.On("GetProvisionedDataByDashboardID", mock.Anything).Return(&models.DashboardProvisioning{ExternalId: "/dashboard1.json"}, nil).Once()

			dash := getDashboardShouldReturn200WithConfig(t, sc, fakeProvisioningService, dashboardStore, dashboardService)

			assert.Equal(t, "../../../dashboard1.json", dash.Meta.ProvisionedExternalId, mockSQLStore)
		}, mockSQLStore)

		loggedInUserScenarioWithRole(t, "When allowUiUpdates is true and calling GET on", "GET", "/api/dashboards/uid/dash", "/api/dashboards/uid/:uid", models.ROLE_EDITOR, func(sc *scenarioContext) {
			setUp()
			fakeProvisioningService := provisioning.NewProvisioningServiceMock(context.Background())
			fakeProvisioningService.GetDashboardProvisionerResolvedPathFunc = func(name string) string {
				return "/tmp/grafana/dashboards"
			}

			fakeProvisioningService.GetAllowUIUpdatesFromConfigFunc = func(name string) bool {
				return true
			}

			hs := &HTTPServer{
				Cfg:                          setting.NewCfg(),
				ProvisioningService:          fakeProvisioningService,
				LibraryPanelService:          &mockLibraryPanelService{},
				LibraryElementService:        &mockLibraryElementService{},
				dashboardProvisioningService: mockDashboardProvisioningService{},
				CoremodelRegistry:            setupDashboardCoremodel(t),
				SQLStore:                     mockSQLStore,
				AccessControl:                accesscontrolmock.New(),
				dashboardService:             dashboardService,
			}
			hs.callGetDashboard(sc)

			assert.Equal(t, 200, sc.resp.Code)

			dash := dtos.DashboardFullWithMeta{}
			err := json.NewDecoder(sc.resp.Body).Decode(&dash)
			require.NoError(t, err)

			assert.Equal(t, false, dash.Meta.Provisioned)
		}, mockSQLStore)
	})
}

func getDashboardShouldReturn200WithConfig(t *testing.T, sc *scenarioContext, provisioningService provisioning.ProvisioningService, dashboardStore dashboards.Store, dashboardService dashboards.DashboardService) dtos.DashboardFullWithMeta {
	t.Helper()

	if provisioningService == nil {
		provisioningService = provisioning.NewProvisioningServiceMock(context.Background())
	}

	if dashboardStore == nil {
		sql := sqlstore.InitTestDB(t)
		dashboardStore = database.ProvideDashboardStore(sql)
	}

	libraryPanelsService := mockLibraryPanelService{}
	libraryElementsService := mockLibraryElementService{}
	cfg := setting.NewCfg()
	features := featuremgmt.WithFeatures()

	if dashboardService == nil {
		dashboardService = service.ProvideDashboardService(cfg, dashboardStore, nil, features, nil, accesscontrolmock.NewMockedPermissionsService())
	}

	hs := &HTTPServer{
		Cfg:                   cfg,
		LibraryPanelService:   &libraryPanelsService,
		LibraryElementService: &libraryElementsService,
		SQLStore:              sc.sqlStore,
		ProvisioningService:   provisioningService,
		CoremodelRegistry:     setupDashboardCoremodel(t),
		AccessControl:         accesscontrolmock.New(),
		dashboardProvisioningService: service.ProvideDashboardService(
			cfg, dashboardStore, nil, features,
			accesscontrolmock.NewMockedPermissionsService(), accesscontrolmock.NewMockedPermissionsService(),
		),
		dashboardService: dashboardService,
	}

	hs.callGetDashboard(sc)

	require.Equal(sc.t, 200, sc.resp.Code)

	dash := dtos.DashboardFullWithMeta{}
	err := json.NewDecoder(sc.resp.Body).Decode(&dash)
	require.NoError(sc.t, err)

	return dash
}

func (hs *HTTPServer) callGetDashboard(sc *scenarioContext) {
	sc.handlerFunc = hs.GetDashboard
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func (hs *HTTPServer) callGetDashboardVersion(sc *scenarioContext) {
	sc.handlerFunc = hs.GetDashboardVersion
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func (hs *HTTPServer) callGetDashboardVersions(sc *scenarioContext) {
	sc.handlerFunc = hs.GetDashboardVersions
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func (hs *HTTPServer) callDeleteDashboardByUID(t *testing.T,
	sc *scenarioContext, mockDashboard *dashboards.FakeDashboardService) {
	hs.dashboardService = mockDashboard
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

func postDashboardScenario(t *testing.T, desc string, url string, routePattern string, cmd models.SaveDashboardCommand, dashboardService dashboards.DashboardService, folderService dashboards.FolderService, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		cfg := setting.NewCfg()
		hs := HTTPServer{
			Cfg:                 cfg,
			ProvisioningService: provisioning.NewProvisioningServiceMock(context.Background()),
			Live:                newTestLive(t, sqlstore.InitTestDB(t)),
			QuotaService: &quota.QuotaService{
				Cfg: cfg,
			},
			pluginStore:           &fakePluginStore{},
			LibraryPanelService:   &mockLibraryPanelService{},
			LibraryElementService: &mockLibraryElementService{},
			CoremodelRegistry:     setupDashboardCoremodel(t),
			dashboardService:      dashboardService,
			folderService:         folderService,
			Features:              featuremgmt.WithFeatures(),
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{OrgId: cmd.OrgId, UserId: cmd.UserId}

			return hs.PostDashboard(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func postDiffScenario(t *testing.T, desc string, url string, routePattern string, cmd dtos.CalculateDiffOptions, role models.RoleType, fn scenarioFunc, sqlmock sqlstore.Store) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		cfg := setting.NewCfg()
		hs := HTTPServer{
			Cfg:                   cfg,
			ProvisioningService:   provisioning.NewProvisioningServiceMock(context.Background()),
			Live:                  newTestLive(t, sqlstore.InitTestDB(t)),
			QuotaService:          &quota.QuotaService{Cfg: cfg},
			LibraryPanelService:   &mockLibraryPanelService{},
			LibraryElementService: &mockLibraryElementService{},
			CoremodelRegistry:     setupDashboardCoremodel(t),
			SQLStore:              sqlmock,
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{
				OrgId:  testOrgID,
				UserId: testUserID,
			}
			sc.context.OrgRole = role

			return hs.CalculateDashboardDiff(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func restoreDashboardVersionScenario(t *testing.T, desc string, url string, routePattern string, mock *dashboards.FakeDashboardService, cmd dtos.RestoreDashboardVersionCommand, fn scenarioFunc, sqlStore sqlstore.Store) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		cfg := setting.NewCfg()
		hs := HTTPServer{
			Cfg:                   cfg,
			ProvisioningService:   provisioning.NewProvisioningServiceMock(context.Background()),
			Live:                  newTestLive(t, sqlstore.InitTestDB(t)),
			QuotaService:          &quota.QuotaService{Cfg: cfg},
			LibraryPanelService:   &mockLibraryPanelService{},
			LibraryElementService: &mockLibraryElementService{},
			CoremodelRegistry:     setupDashboardCoremodel(t),
			dashboardService:      mock,
			SQLStore:              sqlStore,
			Features:              featuremgmt.WithFeatures(),
		}

		sc := setupScenarioContext(t, url)
		sc.sqlStore = sqlStore
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{
				OrgId:  testOrgID,
				UserId: testUserID,
			}
			sc.context.OrgRole = models.ROLE_ADMIN

			return hs.RestoreDashboardVersion(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func setupDashboardCoremodel(t *testing.T) *coremodel.Registry {
	// TODO abstract and generalize this further for wider reuse
	t.Helper()
	dcm, err := dashboard.ProvideCoremodel(cuectx.ProvideThemaLibrary())
	require.NoError(t, err)
	reg, err := coremodel.NewRegistry(dcm)
	require.NoError(t, err)
	return reg
}

func (sc *scenarioContext) ToJSON() *simplejson.Json {
	result := simplejson.New()
	err := json.NewDecoder(sc.resp.Body).Decode(result)
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

func (m *mockLibraryPanelService) LoadLibraryPanelsForDashboard(c context.Context, dash *models.Dashboard) error {
	return nil
}

func (m *mockLibraryPanelService) CleanLibraryPanelsForDashboard(dash *models.Dashboard) error {
	return nil
}

func (m *mockLibraryPanelService) ConnectLibraryPanelsForDashboard(c context.Context, signedInUser *models.SignedInUser, dash *models.Dashboard) error {
	return nil
}

func (m *mockLibraryPanelService) ImportLibraryPanelsForDashboard(c context.Context, signedInUser *models.SignedInUser, dash *models.Dashboard, folderID int64) error {
	return nil
}

type mockLibraryElementService struct {
}

func (l *mockLibraryElementService) CreateElement(c context.Context, signedInUser *models.SignedInUser, cmd libraryelements.CreateLibraryElementCommand) (libraryelements.LibraryElementDTO, error) {
	return libraryelements.LibraryElementDTO{}, nil
}

// GetElement gets an element from a UID.
func (l *mockLibraryElementService) GetElement(c context.Context, signedInUser *models.SignedInUser, UID string) (libraryelements.LibraryElementDTO, error) {
	return libraryelements.LibraryElementDTO{}, nil
}

// GetElementsForDashboard gets all connected elements for a specific dashboard.
func (l *mockLibraryElementService) GetElementsForDashboard(c context.Context, dashboardID int64) (map[string]libraryelements.LibraryElementDTO, error) {
	return map[string]libraryelements.LibraryElementDTO{}, nil
}

// ConnectElementsToDashboard connects elements to a specific dashboard.
func (l *mockLibraryElementService) ConnectElementsToDashboard(c context.Context, signedInUser *models.SignedInUser, elementUIDs []string, dashboardID int64) error {
	return nil
}

// DisconnectElementsFromDashboard disconnects elements from a specific dashboard.
func (l *mockLibraryElementService) DisconnectElementsFromDashboard(c context.Context, dashboardID int64) error {
	return nil
}

// DeleteLibraryElementsInFolder deletes all elements for a specific folder.
func (l *mockLibraryElementService) DeleteLibraryElementsInFolder(c context.Context, signedInUser *models.SignedInUser, folderUID string) error {
	return nil
}

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/web/webtest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	service "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

func TestHTTPServer_GetFolderPermissionList(t *testing.T) {
	t.Run("should not be able to list acl when user does not have permission to do so", func(t *testing.T) {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {})

		res, err := server.Send(webtest.RequestWithSignedInUser(server.NewGetRequest("/api/folders/1/permissions"), userWithPermissions(1, nil)))
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
	})

	t.Run("should be able to list acl with correct permission", func(t *testing.T) {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.folderService = &foldertest.FakeService{ExpectedFolder: &folder.Folder{ID: 1, UID: "1"}}
			hs.folderPermissionsService = &actest.FakePermissionsService{
				ExpectedPermissions: []accesscontrol.ResourcePermission{},
			}
		})

		res, err := server.Send(webtest.RequestWithSignedInUser(server.NewGetRequest("/api/folders/1/permissions"), userWithPermissions(1, []accesscontrol.Permission{
			{Action: dashboards.ActionFoldersPermissionsRead, Scope: "folders:uid:1"},
			{Action: dashboards.ActionFoldersPermissionsWrite, Scope: "folders:uid:1"},
		})))

		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
	})

	t.Run("should filter out hidden users from acl", func(t *testing.T) {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			cfg := setting.NewCfg()
			cfg.HiddenUsers = map[string]struct{}{"hidden": {}}
			hs.Cfg = cfg
			hs.folderService = &foldertest.FakeService{ExpectedFolder: &folder.Folder{ID: 1, UID: "1"}}

			hs.folderPermissionsService = &actest.FakePermissionsService{
				ExpectedPermissions: []accesscontrol.ResourcePermission{
					{UserId: 1, UserLogin: "regular", IsManaged: true},
					{UserId: 2, UserLogin: "hidden", IsManaged: true},
				},
			}
		})

		res, err := server.Send(webtest.RequestWithSignedInUser(server.NewGetRequest("/api/folders/1/permissions"), userWithPermissions(1, []accesscontrol.Permission{
			{Action: dashboards.ActionFoldersPermissionsRead, Scope: "folders:uid:1"},
			{Action: dashboards.ActionFoldersPermissionsWrite, Scope: "folders:uid:1"},
		})))

		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)

		var result []dashboards.DashboardACLInfoDTO
		require.NoError(t, json.NewDecoder(res.Body).Decode(&result))

		assert.Len(t, result, 1)
		assert.Equal(t, result[0].UserLogin, "regular")
		require.NoError(t, res.Body.Close())
	})
}

func TestFolderPermissionAPIEndpoint(t *testing.T) {
	settings := setting.NewCfg()

	folderService := &foldertest.FakeService{}

	dashboardStore := &dashboards.FakeDashboardStore{}
	defer dashboardStore.AssertExpectations(t)

	features := featuremgmt.WithFeatures()
	ac := accesscontrolmock.New()
	folderPermissions := accesscontrolmock.NewMockedPermissionsService()
	dashboardPermissions := accesscontrolmock.NewMockedPermissionsService()
	dashboardService, err := service.ProvideDashboardServiceImpl(
		settings, dashboardStore, foldertest.NewFakeFolderStore(t), nil, features, folderPermissions, dashboardPermissions, ac,
		folderService,
	)
	require.NoError(t, err)

	hs := &HTTPServer{
		Cfg:                         settings,
		Features:                    features,
		folderService:               folderService,
		folderPermissionsService:    folderPermissions,
		dashboardPermissionsService: dashboardPermissions,
		DashboardService:            dashboardService,
		AccessControl:               ac,
	}

	t.Run("Given folder not exists", func(t *testing.T) {
		t.Cleanup(func() {
			folderService.ExpectedError = nil
		})
		folderService.ExpectedError = dashboards.ErrFolderNotFound
		mockSQLStore := dbtest.NewFakeDB()
		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", org.RoleEditor, func(sc *scenarioContext) {
			callGetFolderPermissions(sc, hs)
			assert.Equal(t, 404, sc.resp.Code)
		}, mockSQLStore)

		cmd := dtos.UpdateDashboardACLCommand{
			Items: []dtos.DashboardACLUpdateItem{
				{UserID: 1000, Permission: dashboards.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, updatePermissionContext{
			desc:         "When calling POST on",
			url:          "/api/folders/uid/permissions",
			routePattern: "/api/folders/:uid/permissions",
			cmd:          cmd,
			fn: func(sc *scenarioContext) {
				callUpdateFolderPermissions(t, sc)
				assert.Equal(t, 404, sc.resp.Code)
			},
		}, hs)
	})

	t.Run("Given user has no admin permissions", func(t *testing.T) {
		origNewGuardian := guardian.New
		t.Cleanup(func() {
			guardian.New = origNewGuardian
			folderService.ExpectedError = nil
		})

		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanAdminValue: false})
		folderService.ExpectedError = dashboards.ErrFolderAccessDenied
		mockSQLStore := dbtest.NewFakeDB()

		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", org.RoleEditor, func(sc *scenarioContext) {
			callGetFolderPermissions(sc, hs)
			assert.Equal(t, 403, sc.resp.Code)
		}, mockSQLStore)

		cmd := dtos.UpdateDashboardACLCommand{
			Items: []dtos.DashboardACLUpdateItem{
				{UserID: 1000, Permission: dashboards.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, updatePermissionContext{
			desc:         "When calling POST on",
			url:          "/api/folders/uid/permissions",
			routePattern: "/api/folders/:uid/permissions",
			cmd:          cmd,
			fn: func(sc *scenarioContext) {
				callUpdateFolderPermissions(t, sc)
				assert.Equal(t, 403, sc.resp.Code)
			},
		}, hs)
	})

	t.Run("Given user has admin permissions and permissions to update", func(t *testing.T) {
		origNewGuardian := guardian.New
		t.Cleanup(func() {
			guardian.New = origNewGuardian
		})

		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
			CanAdminValue:                    true,
			CheckPermissionBeforeUpdateValue: true,
			GetACLValue: []*dashboards.DashboardACLInfoDTO{
				{OrgID: 1, DashboardID: 1, UserID: 2, Permission: dashboards.PERMISSION_VIEW},
				{OrgID: 1, DashboardID: 1, UserID: 3, Permission: dashboards.PERMISSION_EDIT},
				{OrgID: 1, DashboardID: 1, UserID: 4, Permission: dashboards.PERMISSION_ADMIN},
				{OrgID: 1, DashboardID: 1, TeamID: 1, Permission: dashboards.PERMISSION_VIEW},
				{OrgID: 1, DashboardID: 1, TeamID: 2, Permission: dashboards.PERMISSION_ADMIN},
			},
		})

		folderService.ExpectedFolder = &folder.Folder{ID: 1, UID: "uid", Title: "Folder"}
		mockSQLStore := dbtest.NewFakeDB()

		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", org.RoleAdmin, func(sc *scenarioContext) {
			callGetFolderPermissions(sc, hs)
			assert.Equal(t, 200, sc.resp.Code)

			var resp []*dashboards.DashboardACLInfoDTO
			err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
			require.NoError(t, err)

			assert.Len(t, resp, 5)
			assert.Equal(t, int64(2), resp[0].UserID)
			assert.Equal(t, dashboards.PERMISSION_VIEW, resp[0].Permission)
		}, mockSQLStore)

		cmd := dtos.UpdateDashboardACLCommand{
			Items: []dtos.DashboardACLUpdateItem{
				{UserID: 1000, Permission: dashboards.PERMISSION_ADMIN},
			},
		}

		folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil).Once()
		updateFolderPermissionScenario(t, updatePermissionContext{
			desc:         "When calling POST on",
			url:          "/api/folders/uid/permissions",
			routePattern: "/api/folders/:uid/permissions",
			cmd:          cmd,
			fn: func(sc *scenarioContext) {
				callUpdateFolderPermissions(t, sc)
				assert.Equal(t, 200, sc.resp.Code)

				var resp struct {
					Message string
				}
				err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
				require.NoError(t, err)

				assert.Equal(t, "Folder permissions updated", resp.Message)
			},
		}, hs)
	})

	t.Run("When trying to update permissions with duplicate permissions", func(t *testing.T) {
		origNewGuardian := guardian.New
		t.Cleanup(func() {
			guardian.New = origNewGuardian
		})

		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
			CanAdminValue:                    true,
			CheckPermissionBeforeUpdateValue: false,
			CheckPermissionBeforeUpdateError: guardian.ErrGuardianPermissionExists,
		})

		folderService.ExpectedFolder = &folder.Folder{ID: 1, UID: "uid", Title: "Folder"}

		cmd := dtos.UpdateDashboardACLCommand{
			Items: []dtos.DashboardACLUpdateItem{
				{UserID: 1000, Permission: dashboards.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, updatePermissionContext{
			desc:         "When calling POST on",
			url:          "/api/folders/uid/permissions",
			routePattern: "/api/folders/:uid/permissions",
			cmd:          cmd,
			fn: func(sc *scenarioContext) {
				callUpdateFolderPermissions(t, sc)
				assert.Equal(t, 400, sc.resp.Code)
			},
		}, hs)
	})

	t.Run("When trying to update team or user permissions with a role", func(t *testing.T) {
		role := org.RoleAdmin
		cmds := []dtos.UpdateDashboardACLCommand{
			{
				Items: []dtos.DashboardACLUpdateItem{
					{UserID: 1000, Permission: dashboards.PERMISSION_ADMIN, Role: &role},
				},
			},
			{
				Items: []dtos.DashboardACLUpdateItem{
					{TeamID: 1000, Permission: dashboards.PERMISSION_ADMIN, Role: &role},
				},
			},
		}

		for _, cmd := range cmds {
			updateFolderPermissionScenario(t, updatePermissionContext{
				desc:         "When calling POST on",
				url:          "/api/folders/uid/permissions",
				routePattern: "/api/folders/:uid/permissions",
				cmd:          cmd,
				fn: func(sc *scenarioContext) {
					callUpdateFolderPermissions(t, sc)
					assert.Equal(t, 400, sc.resp.Code)
					respJSON, err := jsonMap(sc.resp.Body.Bytes())
					require.NoError(t, err)
					assert.Equal(t, dashboards.ErrPermissionsWithRoleNotAllowed.Error(), respJSON["error"])
				},
			}, hs)
		}
	})

	t.Run("When trying to override inherited permissions with lower precedence", func(t *testing.T) {
		origNewGuardian := guardian.New
		t.Cleanup(func() {
			guardian.New = origNewGuardian
		})

		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
			CanAdminValue:                    true,
			CheckPermissionBeforeUpdateValue: false,
			CheckPermissionBeforeUpdateError: guardian.ErrGuardianOverride},
		)

		folderService.ExpectedFolder = &folder.Folder{ID: 1, UID: "uid", Title: "Folder"}

		cmd := dtos.UpdateDashboardACLCommand{
			Items: []dtos.DashboardACLUpdateItem{
				{UserID: 1000, Permission: dashboards.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, updatePermissionContext{
			desc:         "When calling POST on",
			url:          "/api/folders/uid/permissions",
			routePattern: "/api/folders/:uid/permissions",
			cmd:          cmd,
			fn: func(sc *scenarioContext) {
				callUpdateFolderPermissions(t, sc)
				assert.Equal(t, 400, sc.resp.Code)
			},
		}, hs)
	})

	t.Run("Getting and updating folder permissions with hidden users", func(t *testing.T) {
		origNewGuardian := guardian.New
		settings.HiddenUsers = map[string]struct{}{
			"hiddenUser":  {},
			testUserLogin: {},
		}
		t.Cleanup(func() {
			guardian.New = origNewGuardian
			settings.HiddenUsers = make(map[string]struct{})
		})

		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
			CanAdminValue:                    true,
			CheckPermissionBeforeUpdateValue: true,
			GetACLValue: []*dashboards.DashboardACLInfoDTO{
				{OrgID: 1, DashboardID: 1, UserID: 2, UserLogin: "hiddenUser", Permission: dashboards.PERMISSION_VIEW},
				{OrgID: 1, DashboardID: 1, UserID: 3, UserLogin: testUserLogin, Permission: dashboards.PERMISSION_EDIT},
				{OrgID: 1, DashboardID: 1, UserID: 4, UserLogin: "user_1", Permission: dashboards.PERMISSION_ADMIN},
			},
			GetHiddenACLValue: []*dashboards.DashboardACL{
				{OrgID: 1, DashboardID: 1, UserID: 2, Permission: dashboards.PERMISSION_VIEW},
			},
		})

		folderService.ExpectedFolder = &folder.Folder{ID: 1, UID: "uid", Title: "Folder"}

		var resp []*dashboards.DashboardACLInfoDTO
		mockSQLStore := dbtest.NewFakeDB()
		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", org.RoleAdmin, func(sc *scenarioContext) {
			callGetFolderPermissions(sc, hs)
			assert.Equal(t, 200, sc.resp.Code)

			err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
			require.NoError(t, err)

			assert.Len(t, resp, 2)
			assert.Equal(t, int64(3), resp[0].UserID)
			assert.Equal(t, dashboards.PERMISSION_EDIT, resp[0].Permission)
			assert.Equal(t, int64(4), resp[1].UserID)
			assert.Equal(t, dashboards.PERMISSION_ADMIN, resp[1].Permission)
		}, mockSQLStore)

		cmd := dtos.UpdateDashboardACLCommand{
			Items: []dtos.DashboardACLUpdateItem{
				{UserID: 1000, Permission: dashboards.PERMISSION_ADMIN},
			},
		}
		for _, acl := range resp {
			cmd.Items = append(cmd.Items, dtos.DashboardACLUpdateItem{
				UserID:     acl.UserID,
				Permission: acl.Permission,
			})
		}
		assert.Len(t, cmd.Items, 3)

		folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil).Once()
		updateFolderPermissionScenario(t, updatePermissionContext{
			desc:         "When calling POST on",
			url:          "/api/folders/uid/permissions",
			routePattern: "/api/folders/:uid/permissions",
			cmd:          cmd,
			fn: func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 200, sc.resp.Code)
			},
		}, hs)
	})
}

func callGetFolderPermissions(sc *scenarioContext, hs *HTTPServer) {
	sc.handlerFunc = hs.GetFolderPermissionList
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func callUpdateFolderPermissions(t *testing.T, sc *scenarioContext) {
	t.Helper()
	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func updateFolderPermissionScenario(t *testing.T, ctx updatePermissionContext, hs *HTTPServer) {
	t.Run(fmt.Sprintf("%s %s", ctx.desc, ctx.url), func(t *testing.T) {
		sc := setupScenarioContext(t, ctx.url)

		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(ctx.cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.OrgID = testOrgID
			sc.context.UserID = testUserID

			return hs.UpdateFolderPermissions(c)
		})

		sc.m.Post(ctx.routePattern, sc.defaultHandler)

		ctx.fn(sc)
	})
}

package api

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
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

func TestFolderPermissionAPIEndpoint(t *testing.T) {
	settings := setting.NewCfg()

	folderService := &foldertest.FakeService{}

	dashboardStore := &dashboards.FakeDashboardStore{}
	defer dashboardStore.AssertExpectations(t)

	features := featuremgmt.WithFeatures()
	ac := accesscontrolmock.New()
	folderPermissions := accesscontrolmock.NewMockedPermissionsService()
	dashboardPermissions := accesscontrolmock.NewMockedPermissionsService()

	hs := &HTTPServer{
		Cfg:                         settings,
		Features:                    features,
		folderService:               folderService,
		folderPermissionsService:    folderPermissions,
		dashboardPermissionsService: dashboardPermissions,
		DashboardService: service.ProvideDashboardServiceImpl(
			settings, dashboardStore, foldertest.NewFakeFolderStore(t), nil, features, folderPermissions, dashboardPermissions, ac,
			folderService,
		),
		AccessControl: accesscontrolmock.New().WithDisabled(),
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
		dashboardStore.On("UpdateDashboardACL", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
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

		updateFolderPermissionScenario(t, updatePermissionContext{
			desc:         "When calling POST on",
			url:          "/api/folders/uid/permissions",
			routePattern: "/api/folders/:uid/permissions",
			cmd:          cmd,
			fn: func(sc *scenarioContext) {
				callUpdateFolderPermissions(t, sc)
				assert.Equal(t, 200, sc.resp.Code)

				var resp struct {
					ID    int64
					Title string
				}
				err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
				require.NoError(t, err)

				assert.Equal(t, int64(1), resp.ID)
				assert.Equal(t, "Folder", resp.Title)
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

		var gotItems []*dashboards.DashboardACL

		folderService.ExpectedFolder = &folder.Folder{ID: 1, UID: "uid", Title: "Folder"}
		dashboardStore.On("UpdateDashboardACL", mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			gotItems = args.Get(2).([]*dashboards.DashboardACL)
		}).Return(nil).Once()

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

		updateFolderPermissionScenario(t, updatePermissionContext{
			desc:         "When calling POST on",
			url:          "/api/folders/uid/permissions",
			routePattern: "/api/folders/:uid/permissions",
			cmd:          cmd,
			fn: func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 200, sc.resp.Code)
				assert.Len(t, gotItems, 4)
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

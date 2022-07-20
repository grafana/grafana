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
	"github.com/grafana/grafana/pkg/models"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	service "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestFolderPermissionAPIEndpoint(t *testing.T) {
	settings := setting.NewCfg()

	folderService := &dashboards.FakeFolderService{}
	defer folderService.AssertExpectations(t)

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
		DashboardService: service.ProvideDashboardService(
			settings, dashboardStore, nil, features, folderPermissions, dashboardPermissions, ac,
		),
		AccessControl: accesscontrolmock.New().WithDisabled(),
	}

	t.Run("Given folder not exists", func(t *testing.T) {
		folderService.On("GetFolderByUID", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, dashboards.ErrFolderNotFound).Twice()
		mockSQLStore := mockstore.NewSQLStoreMock()
		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", models.ROLE_EDITOR, func(sc *scenarioContext) {
			callGetFolderPermissions(sc, hs)
			assert.Equal(t, 404, sc.resp.Code)
		}, mockSQLStore)

		cmd := dtos.UpdateDashboardACLCommand{
			Items: []dtos.DashboardACLUpdateItem{
				{UserID: 1000, Permission: models.PERMISSION_ADMIN},
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
		})

		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanAdminValue: false})
		folderService.On("GetFolderByUID", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, dashboards.ErrFolderAccessDenied).Twice()
		mockSQLStore := mockstore.NewSQLStoreMock()

		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", models.ROLE_EDITOR, func(sc *scenarioContext) {
			callGetFolderPermissions(sc, hs)
			assert.Equal(t, 403, sc.resp.Code)
		}, mockSQLStore)

		cmd := dtos.UpdateDashboardACLCommand{
			Items: []dtos.DashboardACLUpdateItem{
				{UserID: 1000, Permission: models.PERMISSION_ADMIN},
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
			GetACLValue: []*models.DashboardACLInfoDTO{
				{OrgId: 1, DashboardId: 1, UserId: 2, Permission: models.PERMISSION_VIEW},
				{OrgId: 1, DashboardId: 1, UserId: 3, Permission: models.PERMISSION_EDIT},
				{OrgId: 1, DashboardId: 1, UserId: 4, Permission: models.PERMISSION_ADMIN},
				{OrgId: 1, DashboardId: 1, TeamId: 1, Permission: models.PERMISSION_VIEW},
				{OrgId: 1, DashboardId: 1, TeamId: 2, Permission: models.PERMISSION_ADMIN},
			},
		})

		folderResponse := &models.Folder{Id: 1, Uid: "uid", Title: "Folder"}
		folderService.On("GetFolderByUID", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(folderResponse, nil).Twice()
		dashboardStore.On("UpdateDashboardACL", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
		mockSQLStore := mockstore.NewSQLStoreMock()

		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", models.ROLE_ADMIN, func(sc *scenarioContext) {
			callGetFolderPermissions(sc, hs)
			assert.Equal(t, 200, sc.resp.Code)

			var resp []*models.DashboardACLInfoDTO
			err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
			require.NoError(t, err)

			assert.Len(t, resp, 5)
			assert.Equal(t, int64(2), resp[0].UserId)
			assert.Equal(t, models.PERMISSION_VIEW, resp[0].Permission)
		}, mockSQLStore)

		cmd := dtos.UpdateDashboardACLCommand{
			Items: []dtos.DashboardACLUpdateItem{
				{UserID: 1000, Permission: models.PERMISSION_ADMIN},
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

		folderResponse := &models.Folder{Id: 1, Uid: "uid", Title: "Folder"}
		folderService.On("GetFolderByUID", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(folderResponse, nil).Once()

		cmd := dtos.UpdateDashboardACLCommand{
			Items: []dtos.DashboardACLUpdateItem{
				{UserID: 1000, Permission: models.PERMISSION_ADMIN},
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
		role := models.ROLE_ADMIN
		cmds := []dtos.UpdateDashboardACLCommand{
			{
				Items: []dtos.DashboardACLUpdateItem{
					{UserID: 1000, Permission: models.PERMISSION_ADMIN, Role: &role},
				},
			},
			{
				Items: []dtos.DashboardACLUpdateItem{
					{TeamID: 1000, Permission: models.PERMISSION_ADMIN, Role: &role},
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
					assert.Equal(t, models.ErrPermissionsWithRoleNotAllowed.Error(), respJSON["error"])
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

		folderResponse := &models.Folder{Id: 1, Uid: "uid", Title: "Folder"}
		folderService.On("GetFolderByUID", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(folderResponse, nil).Once()

		cmd := dtos.UpdateDashboardACLCommand{
			Items: []dtos.DashboardACLUpdateItem{
				{UserID: 1000, Permission: models.PERMISSION_ADMIN},
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
			GetACLValue: []*models.DashboardACLInfoDTO{
				{OrgId: 1, DashboardId: 1, UserId: 2, UserLogin: "hiddenUser", Permission: models.PERMISSION_VIEW},
				{OrgId: 1, DashboardId: 1, UserId: 3, UserLogin: testUserLogin, Permission: models.PERMISSION_EDIT},
				{OrgId: 1, DashboardId: 1, UserId: 4, UserLogin: "user_1", Permission: models.PERMISSION_ADMIN},
			},
			GetHiddenACLValue: []*models.DashboardACL{
				{OrgID: 1, DashboardID: 1, UserID: 2, Permission: models.PERMISSION_VIEW},
			},
		})

		var gotItems []*models.DashboardACL

		folderResponse := &models.Folder{Id: 1, Uid: "uid", Title: "Folder"}
		folderService.On("GetFolderByUID", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(folderResponse, nil).Twice()
		dashboardStore.On("UpdateDashboardACL", mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			gotItems = args.Get(2).([]*models.DashboardACL)
		}).Return(nil).Once()

		var resp []*models.DashboardACLInfoDTO
		mockSQLStore := mockstore.NewSQLStoreMock()
		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", models.ROLE_ADMIN, func(sc *scenarioContext) {
			callGetFolderPermissions(sc, hs)
			assert.Equal(t, 200, sc.resp.Code)

			err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
			require.NoError(t, err)

			assert.Len(t, resp, 2)
			assert.Equal(t, int64(3), resp[0].UserId)
			assert.Equal(t, models.PERMISSION_EDIT, resp[0].Permission)
			assert.Equal(t, int64(4), resp[1].UserId)
			assert.Equal(t, models.PERMISSION_ADMIN, resp[1].Permission)
		}, mockSQLStore)

		cmd := dtos.UpdateDashboardACLCommand{
			Items: []dtos.DashboardACLUpdateItem{
				{UserID: 1000, Permission: models.PERMISSION_ADMIN},
			},
		}
		for _, acl := range resp {
			cmd.Items = append(cmd.Items, dtos.DashboardACLUpdateItem{
				UserID:     acl.UserId,
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

		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(ctx.cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.OrgId = testOrgID
			sc.context.UserId = testUserID

			return hs.UpdateFolderPermissions(c)
		})

		sc.m.Post(ctx.routePattern, sc.defaultHandler)

		ctx.fn(sc)
	})
}

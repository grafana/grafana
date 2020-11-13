package api

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFolderPermissionAPIEndpoint(t *testing.T) {
	settings := setting.NewCfg()
	hs := &HTTPServer{Cfg: settings}

	t.Run("Given folder not exists", func(t *testing.T) {
		mock := &fakeFolderService{
			GetFolderByUIDError: models.ErrFolderNotFound,
		}

		origNewFolderService := dashboards.NewFolderService
		t.Cleanup(func() {
			dashboards.NewFolderService = origNewFolderService
		})
		mockFolderService(mock)

		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", models.ROLE_EDITOR, func(sc *scenarioContext) {
			callGetFolderPermissions(sc, hs)
			assert.Equal(t, 404, sc.resp.Code)
		})

		cmd := dtos.UpdateDashboardAclCommand{
			Items: []dtos.DashboardAclUpdateItem{
				{UserId: 1000, Permission: models.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, updatePermissionContext{
			desc:         "When calling POST on",
			url:          "/api/folders/uid/permissions",
			routePattern: "/api/folders/:uid/permissions",
			cmd:          cmd,
			fn: func(sc *scenarioContext) {
				callUpdateFolderPermissions(sc)
				assert.Equal(t, 404, sc.resp.Code)
			},
		}, hs)
	})

	t.Run("Given user has no admin permissions", func(t *testing.T) {
		origNewGuardian := guardian.New
		origNewFolderService := dashboards.NewFolderService
		t.Cleanup(func() {
			guardian.New = origNewGuardian
			dashboards.NewFolderService = origNewFolderService
		})

		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanAdminValue: false})

		mock := &fakeFolderService{
			GetFolderByUIDResult: &models.Folder{
				Id:    1,
				Uid:   "uid",
				Title: "Folder",
			},
		}

		mockFolderService(mock)

		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", models.ROLE_EDITOR, func(sc *scenarioContext) {
			callGetFolderPermissions(sc, hs)
			assert.Equal(t, 403, sc.resp.Code)
		})

		cmd := dtos.UpdateDashboardAclCommand{
			Items: []dtos.DashboardAclUpdateItem{
				{UserId: 1000, Permission: models.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, updatePermissionContext{
			desc:         "When calling POST on",
			url:          "/api/folders/uid/permissions",
			routePattern: "/api/folders/:uid/permissions",
			cmd:          cmd,
			fn: func(sc *scenarioContext) {
				callUpdateFolderPermissions(sc)
				assert.Equal(t, 403, sc.resp.Code)
			},
		}, hs)
	})

	t.Run("Given user has admin permissions and permissions to update", func(t *testing.T) {
		origNewGuardian := guardian.New
		origNewFolderService := dashboards.NewFolderService
		t.Cleanup(func() {
			guardian.New = origNewGuardian
			dashboards.NewFolderService = origNewFolderService
		})

		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
			CanAdminValue:                    true,
			CheckPermissionBeforeUpdateValue: true,
			GetAclValue: []*models.DashboardAclInfoDTO{
				{OrgId: 1, DashboardId: 1, UserId: 2, Permission: models.PERMISSION_VIEW},
				{OrgId: 1, DashboardId: 1, UserId: 3, Permission: models.PERMISSION_EDIT},
				{OrgId: 1, DashboardId: 1, UserId: 4, Permission: models.PERMISSION_ADMIN},
				{OrgId: 1, DashboardId: 1, TeamId: 1, Permission: models.PERMISSION_VIEW},
				{OrgId: 1, DashboardId: 1, TeamId: 2, Permission: models.PERMISSION_ADMIN},
			},
		})

		mock := &fakeFolderService{
			GetFolderByUIDResult: &models.Folder{
				Id:    1,
				Uid:   "uid",
				Title: "Folder",
			},
		}

		mockFolderService(mock)

		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", models.ROLE_ADMIN, func(sc *scenarioContext) {
			callGetFolderPermissions(sc, hs)
			assert.Equal(t, 200, sc.resp.Code)
			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			require.NoError(t, err)
			assert.Equal(t, 5, len(respJSON.MustArray()))
			assert.Equal(t, 2, respJSON.GetIndex(0).Get("userId").MustInt())
			assert.Equal(t, int(models.PERMISSION_VIEW), respJSON.GetIndex(0).Get("permission").MustInt())
		})

		cmd := dtos.UpdateDashboardAclCommand{
			Items: []dtos.DashboardAclUpdateItem{
				{UserId: 1000, Permission: models.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, updatePermissionContext{
			desc:         "When calling POST on",
			url:          "/api/folders/uid/permissions",
			routePattern: "/api/folders/:uid/permissions",
			cmd:          cmd,
			fn: func(sc *scenarioContext) {
				callUpdateFolderPermissions(sc)
				assert.Equal(t, 200, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, 1, respJSON.Get("id").MustInt())
				assert.Equal(t, "Folder", respJSON.Get("title").MustString())
			},
		}, hs)
	})

	t.Run("When trying to update permissions with duplicate permissions", func(t *testing.T) {
		origNewGuardian := guardian.New
		origNewFolderService := dashboards.NewFolderService
		t.Cleanup(func() {
			guardian.New = origNewGuardian
			dashboards.NewFolderService = origNewFolderService
		})

		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
			CanAdminValue:                    true,
			CheckPermissionBeforeUpdateValue: false,
			CheckPermissionBeforeUpdateError: guardian.ErrGuardianPermissionExists,
		})

		mock := &fakeFolderService{
			GetFolderByUIDResult: &models.Folder{
				Id:    1,
				Uid:   "uid",
				Title: "Folder",
			},
		}

		mockFolderService(mock)

		cmd := dtos.UpdateDashboardAclCommand{
			Items: []dtos.DashboardAclUpdateItem{
				{UserId: 1000, Permission: models.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, updatePermissionContext{
			desc:         "When calling POST on",
			url:          "/api/folders/uid/permissions",
			routePattern: "/api/folders/:uid/permissions",
			cmd:          cmd,
			fn: func(sc *scenarioContext) {
				callUpdateFolderPermissions(sc)
				assert.Equal(t, 400, sc.resp.Code)
			},
		}, hs)
	})

	t.Run("When trying to override inherited permissions with lower precedence", func(t *testing.T) {
		origNewGuardian := guardian.New
		origNewFolderService := dashboards.NewFolderService
		t.Cleanup(func() {
			guardian.New = origNewGuardian
			dashboards.NewFolderService = origNewFolderService
		})

		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
			CanAdminValue:                    true,
			CheckPermissionBeforeUpdateValue: false,
			CheckPermissionBeforeUpdateError: guardian.ErrGuardianOverride},
		)

		mock := &fakeFolderService{
			GetFolderByUIDResult: &models.Folder{
				Id:    1,
				Uid:   "uid",
				Title: "Folder",
			},
		}

		mockFolderService(mock)

		cmd := dtos.UpdateDashboardAclCommand{
			Items: []dtos.DashboardAclUpdateItem{
				{UserId: 1000, Permission: models.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, updatePermissionContext{
			desc:         "When calling POST on",
			url:          "/api/folders/uid/permissions",
			routePattern: "/api/folders/:uid/permissions",
			cmd:          cmd,
			fn: func(sc *scenarioContext) {
				callUpdateFolderPermissions(sc)
				assert.Equal(t, 400, sc.resp.Code)
			},
		}, hs)
	})

	t.Run("Getting folder permissions without hidden users (except for signed in user)", func(t *testing.T) {
		origNewGuardian := guardian.New
		origNewFolderService := dashboards.NewFolderService
		settings.HiddenUsers = map[string]struct{}{
			"hiddenUser":  {},
			TestUserLogin: {},
		}
		t.Cleanup(func() {
			guardian.New = origNewGuardian
			dashboards.NewFolderService = origNewFolderService
			settings.HiddenUsers = make(map[string]struct{})
		})

		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
			CanAdminValue:                    true,
			CheckPermissionBeforeUpdateValue: true,
			GetAclValue: []*models.DashboardAclInfoDTO{
				{OrgId: 1, DashboardId: 1, UserId: 2, UserLogin: "hiddenUser", Permission: models.PERMISSION_VIEW},
				{OrgId: 1, DashboardId: 1, UserId: 3, UserLogin: TestUserLogin, Permission: models.PERMISSION_EDIT},
				{OrgId: 1, DashboardId: 1, UserId: 4, UserLogin: "user_1", Permission: models.PERMISSION_ADMIN},
			},
		})

		mock := &fakeFolderService{
			GetFolderByUIDResult: &models.Folder{
				Id:    1,
				Uid:   "uid",
				Title: "Folder",
			},
		}

		mockFolderService(mock)

		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", models.ROLE_ADMIN, func(sc *scenarioContext) {
			callGetFolderPermissions(sc, hs)
			assert.Equal(t, 200, sc.resp.Code)
			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			require.NoError(t, err)
			assert.Equal(t, 2, len(respJSON.MustArray()))
			assert.Equal(t, 3, respJSON.GetIndex(0).Get("userId").MustInt())
			assert.Equal(t, int(models.PERMISSION_EDIT), respJSON.GetIndex(0).Get("permission").MustInt())
			assert.Equal(t, 4, respJSON.GetIndex(0).Get("userId").MustInt())
			assert.Equal(t, int(models.PERMISSION_ADMIN), respJSON.GetIndex(0).Get("permission").MustInt())
		})
	})
}

func callGetFolderPermissions(sc *scenarioContext, hs *HTTPServer) {
	sc.handlerFunc = hs.GetFolderPermissionList
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func callUpdateFolderPermissions(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *models.UpdateDashboardAclCommand) error {
		return nil
	})

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func updateFolderPermissionScenario(t *testing.T, ctx updatePermissionContext, hs *HTTPServer) {
	t.Run(fmt.Sprintf("%s %s", ctx.desc, ctx.url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(t, ctx.url)

		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.OrgId = testOrgID
			sc.context.UserId = testUserID

			return hs.UpdateFolderPermissions(c, ctx.cmd)
		})

		sc.m.Post(ctx.routePattern, sc.defaultHandler)

		ctx.fn(sc)
	})
}

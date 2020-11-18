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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFolderPermissionAPIEndpoint(t *testing.T) {
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
			callGetFolderPermissions(sc)
			assert.Equal(t, 404, sc.resp.Code)
		})

		cmd := dtos.UpdateDashboardAclCommand{
			Items: []dtos.DashboardAclUpdateItem{
				{UserID: 1000, Permission: models.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, "When calling POST on", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", cmd, func(sc *scenarioContext) {
			callUpdateFolderPermissions(sc)
			assert.Equal(t, 404, sc.resp.Code)
		})
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
			callGetFolderPermissions(sc)
			assert.Equal(t, 403, sc.resp.Code)
		})

		cmd := dtos.UpdateDashboardAclCommand{
			Items: []dtos.DashboardAclUpdateItem{
				{UserID: 1000, Permission: models.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, "When calling POST on", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", cmd, func(sc *scenarioContext) {
			callUpdateFolderPermissions(sc)
			assert.Equal(t, 403, sc.resp.Code)
		})
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
			callGetFolderPermissions(sc)
			assert.Equal(t, 200, sc.resp.Code)
			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			require.NoError(t, err)
			assert.Equal(t, 5, len(respJSON.MustArray()))
			assert.Equal(t, 2, respJSON.GetIndex(0).Get("userId").MustInt())
			assert.Equal(t, int(models.PERMISSION_VIEW), respJSON.GetIndex(0).Get("permission").MustInt())
		})

		cmd := dtos.UpdateDashboardAclCommand{
			Items: []dtos.DashboardAclUpdateItem{
				{UserID: 1000, Permission: models.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, "When calling POST on", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", cmd, func(sc *scenarioContext) {
			callUpdateFolderPermissions(sc)
			assert.Equal(t, 200, sc.resp.Code)
			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			require.NoError(t, err)
			assert.Equal(t, 1, respJSON.Get("id").MustInt())
			assert.Equal(t, "Folder", respJSON.Get("title").MustString())
		})
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
				{UserID: 1000, Permission: models.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, "When calling POST on", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", cmd, func(sc *scenarioContext) {
			callUpdateFolderPermissions(sc)
			assert.Equal(t, 400, sc.resp.Code)
		})
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
				{UserID: 1000, Permission: models.PERMISSION_ADMIN},
			},
		}

		updateFolderPermissionScenario(t, "When calling POST on", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", cmd, func(sc *scenarioContext) {
			callUpdateFolderPermissions(sc)
			assert.Equal(t, 400, sc.resp.Code)
		})
	})
}

func callGetFolderPermissions(sc *scenarioContext) {
	sc.handlerFunc = GetFolderPermissionList
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func callUpdateFolderPermissions(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *models.UpdateDashboardAclCommand) error {
		return nil
	})

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func updateFolderPermissionScenario(t *testing.T, desc string, url string, routePattern string, cmd dtos.UpdateDashboardAclCommand, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(t, url)

		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.OrgId = testOrgID
			sc.context.UserId = testUserID

			return UpdateFolderPermissions(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

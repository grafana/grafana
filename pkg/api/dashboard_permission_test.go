package api

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDashboardPermissionAPIEndpoint(t *testing.T) {
	t.Run("Dashboard permissions test", func(t *testing.T) {
		t.Run("Given dashboard not exists", func(t *testing.T) {
			setUp := func() {
				bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
					return models.ErrDashboardNotFound
				})
			}

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/1/permissions",
				"/api/dashboards/id/:id/permissions", models.ROLE_EDITOR, func(sc *scenarioContext) {
					setUp()
					callGetDashboardPermissions(sc)
					assert.Equal(t, 404, sc.resp.Code)
				})

			cmd := dtos.UpdateDashboardAclCommand{
				Items: []dtos.DashboardAclUpdateItem{
					{UserID: 1000, Permission: models.PERMISSION_ADMIN},
				},
			}

			updateDashboardPermissionScenario(t, "When calling POST on", "/api/dashboards/id/1/permissions",
				"/api/dashboards/id/:id/permissions", cmd, func(sc *scenarioContext) {
					setUp()
					callUpdateDashboardPermissions(sc)
					assert.Equal(t, 404, sc.resp.Code)
				})
		})

		t.Run("Given user has no admin permissions", func(t *testing.T) {
			origNewGuardian := guardian.New
			t.Cleanup(func() {
				guardian.New = origNewGuardian
			})

			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanAdminValue: false})

			getDashboardQueryResult := models.NewDashboard("Dash")

			setUp := func() {
				bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
					query.Result = getDashboardQueryResult
					return nil
				})
			}

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/1/permissions",
				"/api/dashboards/id/:id/permissions", models.ROLE_EDITOR, func(sc *scenarioContext) {
					setUp()
					callGetDashboardPermissions(sc)
					assert.Equal(t, 403, sc.resp.Code)
				})

			cmd := dtos.UpdateDashboardAclCommand{
				Items: []dtos.DashboardAclUpdateItem{
					{UserID: 1000, Permission: models.PERMISSION_ADMIN},
				},
			}

			updateDashboardPermissionScenario(t, "When calling POST on", "/api/dashboards/id/1/permissions",
				"/api/dashboards/id/:id/permissions", cmd, func(sc *scenarioContext) {
					setUp()
					callUpdateDashboardPermissions(sc)
					assert.Equal(t, 403, sc.resp.Code)
				})
		})

		t.Run("Given user has admin permissions and permissions to update", func(t *testing.T) {
			origNewGuardian := guardian.New
			t.Cleanup(func() {
				guardian.New = origNewGuardian
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

			setUp := func() {
				getDashboardQueryResult := models.NewDashboard("Dash")
				bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
					query.Result = getDashboardQueryResult
					return nil
				})
			}

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/1/permissions",
				"/api/dashboards/id/:id/permissions", models.ROLE_ADMIN, func(sc *scenarioContext) {
					setUp()
					callGetDashboardPermissions(sc)
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

			updateDashboardPermissionScenario(t, "When calling POST on", "/api/dashboards/id/1/permissions",
				"/api/dashboards/id/:id/permissions", cmd, func(sc *scenarioContext) {
					setUp()
					callUpdateDashboardPermissions(sc)
					assert.Equal(t, 200, sc.resp.Code)
				})
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

			setUp := func() {
				getDashboardQueryResult := models.NewDashboard("Dash")
				bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
					query.Result = getDashboardQueryResult
					return nil
				})
			}

			cmd := dtos.UpdateDashboardAclCommand{
				Items: []dtos.DashboardAclUpdateItem{
					{UserID: 1000, Permission: models.PERMISSION_ADMIN},
				},
			}

			updateDashboardPermissionScenario(t, "When calling POST on", "/api/dashboards/id/1/permissions",
				"/api/dashboards/id/:id/permissions", cmd, func(sc *scenarioContext) {
					setUp()
					callUpdateDashboardPermissions(sc)
					assert.Equal(t, 400, sc.resp.Code)
				})
		})

		t.Run("When trying to update team or user permissions with a role", func(t *testing.T) {
			role := models.ROLE_EDITOR
			cmds := []dtos.UpdateDashboardAclCommand{
				{
					Items: []dtos.DashboardAclUpdateItem{
						{UserID: 1000, Permission: models.PERMISSION_ADMIN, Role: &role},
					},
				},
				{
					Items: []dtos.DashboardAclUpdateItem{
						{TeamID: 1000, Permission: models.PERMISSION_ADMIN, Role: &role},
					},
				},
			}

			for _, cmd := range cmds {
				updateDashboardPermissionScenario(t, "When calling POST on", "/api/dashboards/id/1/permissions",
					"/api/dashboards/id/:id/permissions", cmd, func(sc *scenarioContext) {
						callUpdateDashboardPermissions(sc)
						assert.Equal(t, 400, sc.resp.Code)
						respJSON, err := jsonMap(sc.resp.Body.Bytes())
						require.NoError(t, err)
						assert.Equal(t, models.ErrPermissionsWithRoleNotAllowed.Error(), respJSON["error"])
					})
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

			setUp := func() {
				getDashboardQueryResult := models.NewDashboard("Dash")
				bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
					query.Result = getDashboardQueryResult
					return nil
				})
			}

			cmd := dtos.UpdateDashboardAclCommand{
				Items: []dtos.DashboardAclUpdateItem{
					{UserID: 1000, Permission: models.PERMISSION_ADMIN},
				},
			}

			updateDashboardPermissionScenario(t, "When calling POST on", "/api/dashboards/id/1/permissions",
				"/api/dashboards/id/:id/permissions", cmd, func(sc *scenarioContext) {
					setUp()
					callUpdateDashboardPermissions(sc)
					assert.Equal(t, 400, sc.resp.Code)
				})
		})
	})
}

func callGetDashboardPermissions(sc *scenarioContext) {
	sc.handlerFunc = GetDashboardPermissionList
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func callUpdateDashboardPermissions(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *models.UpdateDashboardAclCommand) error {
		return nil
	})

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func updateDashboardPermissionScenario(t *testing.T, desc string, url string, routePattern string, cmd dtos.UpdateDashboardAclCommand, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		t.Cleanup(bus.ClearBusHandlers)

		sc := setupScenarioContext(t, url)

		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.OrgId = testOrgID
			sc.context.UserId = testUserID

			return UpdateDashboardPermissions(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

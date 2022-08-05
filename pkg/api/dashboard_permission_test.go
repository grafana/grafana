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
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDashboardPermissionAPIEndpoint(t *testing.T) {
	t.Run("Dashboard permissions test", func(t *testing.T) {
		settings := setting.NewCfg()
		dashboardStore := &dashboards.FakeDashboardStore{}
		dashboardStore.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Return(nil, nil)
		defer dashboardStore.AssertExpectations(t)

		features := featuremgmt.WithFeatures()
		mockSQLStore := mockstore.NewSQLStoreMock()
		ac := accesscontrolmock.New()
		folderPermissions := accesscontrolmock.NewMockedPermissionsService()
		dashboardPermissions := accesscontrolmock.NewMockedPermissionsService()

		hs := &HTTPServer{
			Cfg:      settings,
			SQLStore: mockSQLStore,
			Features: features,
			DashboardService: dashboardservice.ProvideDashboardService(
				settings, dashboardStore, nil, features, folderPermissions, dashboardPermissions, ac,
			),
			AccessControl: accesscontrolmock.New().WithDisabled(),
		}

		t.Run("Given user has no admin permissions", func(t *testing.T) {
			origNewGuardian := guardian.New
			t.Cleanup(func() {
				guardian.New = origNewGuardian
			})

			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanAdminValue: false})
			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/1/permissions",
				"/api/dashboards/id/:dashboardId/permissions", models.ROLE_EDITOR, func(sc *scenarioContext) {
					callGetDashboardPermissions(sc, hs)
					assert.Equal(t, 403, sc.resp.Code)
				}, mockSQLStore)

			cmd := dtos.UpdateDashboardACLCommand{
				Items: []dtos.DashboardACLUpdateItem{
					{UserID: 1000, Permission: models.PERMISSION_ADMIN},
				},
			}

			dashboardStore.On("UpdateDashboardACL", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
			updateDashboardPermissionScenario(t, updatePermissionContext{
				desc:         "When calling POST on",
				url:          "/api/dashboards/id/1/permissions",
				routePattern: "/api/dashboards/id/:dashboardId/permissions",
				cmd:          cmd,
				fn: func(sc *scenarioContext) {
					callUpdateDashboardPermissions(t, sc)
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

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/1/permissions",
				"/api/dashboards/id/:dashboardId/permissions", models.ROLE_ADMIN, func(sc *scenarioContext) {
					callGetDashboardPermissions(sc, hs)
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

			updateDashboardPermissionScenario(t, updatePermissionContext{
				desc:         "When calling POST on",
				url:          "/api/dashboards/id/1/permissions",
				routePattern: "/api/dashboards/id/:dashboardId/permissions",
				cmd:          cmd,
				fn: func(sc *scenarioContext) {
					callUpdateDashboardPermissions(t, sc)
					assert.Equal(t, 200, sc.resp.Code)
				},
			}, hs)
		})

		t.Run("When trying to add permissions with both a team and user", func(t *testing.T) {
			origNewGuardian := guardian.New
			t.Cleanup(func() {
				guardian.New = origNewGuardian
			})

			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
				CanAdminValue:                    true,
				CheckPermissionBeforeUpdateValue: true,
			})

			cmd := dtos.UpdateDashboardACLCommand{
				Items: []dtos.DashboardACLUpdateItem{
					{UserID: 1000, TeamID: 1, Permission: models.PERMISSION_ADMIN},
				},
			}

			updateDashboardPermissionScenario(t, updatePermissionContext{
				desc:         "When calling POST on",
				url:          "/api/dashboards/id/1/permissions",
				routePattern: "/api/dashboards/id/:dashboardId/permissions",
				cmd:          cmd,
				fn: func(sc *scenarioContext) {
					callUpdateDashboardPermissions(t, sc)
					assert.Equal(t, 400, sc.resp.Code)
					respJSON, err := jsonMap(sc.resp.Body.Bytes())
					require.NoError(t, err)
					assert.Equal(t, models.ErrPermissionsWithUserAndTeamNotAllowed.Error(), respJSON["error"])
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

			cmd := dtos.UpdateDashboardACLCommand{
				Items: []dtos.DashboardACLUpdateItem{
					{UserID: 1000, Permission: models.PERMISSION_ADMIN},
				},
			}

			updateDashboardPermissionScenario(t, updatePermissionContext{
				desc:         "When calling POST on",
				url:          "/api/dashboards/id/1/permissions",
				routePattern: "/api/dashboards/id/:dashboardId/permissions",
				cmd:          cmd,
				fn: func(sc *scenarioContext) {
					callUpdateDashboardPermissions(t, sc)
					assert.Equal(t, 400, sc.resp.Code)
				},
			}, hs)
		})

		t.Run("When trying to update team or user permissions with a role", func(t *testing.T) {
			role := models.ROLE_EDITOR
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
				updateDashboardPermissionScenario(t, updatePermissionContext{
					desc:         "When calling POST on",
					url:          "/api/dashboards/id/1/permissions",
					routePattern: "/api/dashboards/id/:dashboardId/permissions",
					cmd:          cmd,
					fn: func(sc *scenarioContext) {
						callUpdateDashboardPermissions(t, sc)
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

			cmd := dtos.UpdateDashboardACLCommand{
				Items: []dtos.DashboardACLUpdateItem{
					{UserID: 1000, Permission: models.PERMISSION_ADMIN},
				},
			}

			updateDashboardPermissionScenario(t, updatePermissionContext{
				desc:         "When calling POST on",
				url:          "/api/dashboards/id/1/permissions",
				routePattern: "/api/dashboards/id/:dashboardId/permissions",
				cmd:          cmd,
				fn: func(sc *scenarioContext) {
					callUpdateDashboardPermissions(t, sc)
					assert.Equal(t, 400, sc.resp.Code)
				},
			}, hs)
		})

		t.Run("Getting and updating dashboard permissions with hidden users", func(t *testing.T) {
			origNewGuardian := guardian.New
			settings.HiddenUsers = map[string]struct{}{
				"hiddenUser":  {},
				testUserLogin: {},
			}
			t.Cleanup(func() {
				guardian.New = origNewGuardian
				settings.HiddenUsers = make(map[string]struct{})
			})

			mockSQLStore := mockstore.NewSQLStoreMock()
			var resp []*models.DashboardACLInfoDTO
			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/dashboards/id/1/permissions",
				"/api/dashboards/id/:dashboardId/permissions", models.ROLE_ADMIN, func(sc *scenarioContext) {
					setUp()
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

					callGetDashboardPermissions(sc, hs)
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

			var numOfItems []*models.DashboardACL
			dashboardStore.On("UpdateDashboardACL", mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
				items := args.Get(2).([]*models.DashboardACL)
				numOfItems = items
			}).Return(nil).Once()
			updateDashboardPermissionScenario(t, updatePermissionContext{
				desc:         "When calling POST on",
				url:          "/api/dashboards/id/1/permissions",
				routePattern: "/api/dashboards/id/:dashboardId/permissions",
				cmd:          cmd,
				fn: func(sc *scenarioContext) {
					sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
					assert.Len(t, numOfItems, 4)
				},
			}, hs)
		})
	})
}

func callGetDashboardPermissions(sc *scenarioContext, hs *HTTPServer) {
	sc.handlerFunc = hs.GetDashboardPermissionList
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func callUpdateDashboardPermissions(t *testing.T, sc *scenarioContext) {
	t.Helper()
	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

type updatePermissionContext struct {
	desc         string
	url          string
	routePattern string
	cmd          dtos.UpdateDashboardACLCommand
	fn           scenarioFunc
}

func updateDashboardPermissionScenario(t *testing.T, ctx updatePermissionContext, hs *HTTPServer) {
	t.Run(fmt.Sprintf("%s %s", ctx.desc, ctx.url), func(t *testing.T) {
		sc := setupScenarioContext(t, ctx.url)

		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(ctx.cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.OrgId = testOrgID
			sc.context.UserId = testUserID

			return hs.UpdateDashboardPermissions(c)
		})

		sc.m.Post(ctx.routePattern, sc.defaultHandler)

		ctx.fn(sc)
	})
}

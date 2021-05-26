package api

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type setUpConf struct {
	aclMockResp []*models.DashboardAclInfoDTO
}

func TestAlertingAPIEndpoint(t *testing.T) {
	singleAlert := &models.Alert{Id: 1, DashboardId: 1, Name: "singlealert"}
	viewerRole := models.ROLE_VIEWER
	editorRole := models.ROLE_EDITOR

	setUp := func(confs ...setUpConf) {
		bus.AddHandler("test", func(query *models.GetAlertByIdQuery) error {
			query.Result = singleAlert
			return nil
		})

		aclMockResp := []*models.DashboardAclInfoDTO{}
		for _, c := range confs {
			if c.aclMockResp != nil {
				aclMockResp = c.aclMockResp
			}
		}
		bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
			query.Result = aclMockResp
			return nil
		})

		bus.AddHandler("test", func(query *models.GetTeamsByUserQuery) error {
			query.Result = []*models.TeamDTO{}
			return nil
		})
	}

	t.Run("When user is editor and not in the ACL", func(t *testing.T) {
		cmd := dtos.PauseAlertCommand{
			AlertId: 1,
			Paused:  true,
		}
		postAlertScenario(t, "When calling POST on", "/api/alerts/1/pause", "/api/alerts/:alertId/pause",
			models.ROLE_EDITOR, cmd, func(sc *scenarioContext) {
				setUp()

				callPauseAlert(sc)
				assert.Equal(t, 403, sc.resp.Code)
			})
	})

	t.Run("When user is editor and dashboard has default ACL", func(t *testing.T) {
		cmd := dtos.PauseAlertCommand{
			AlertId: 1,
			Paused:  true,
		}
		postAlertScenario(t, "When calling POST on", "/api/alerts/1/pause", "/api/alerts/:alertId/pause",
			models.ROLE_EDITOR, cmd, func(sc *scenarioContext) {
				setUp(setUpConf{
					aclMockResp: []*models.DashboardAclInfoDTO{
						{Role: &viewerRole, Permission: models.PERMISSION_VIEW},
						{Role: &editorRole, Permission: models.PERMISSION_EDIT},
					},
				})

				callPauseAlert(sc)
				assert.Equal(t, 200, sc.resp.Code)
			})
	})

	loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/alerts?dashboardId=1", "/api/alerts",
		models.ROLE_EDITOR, func(sc *scenarioContext) {
			setUp()

			var searchQuery *search.Query
			bus.AddHandler("test", func(query *search.Query) error {
				searchQuery = query
				return nil
			})

			var getAlertsQuery *models.GetAlertsQuery
			bus.AddHandler("test", func(query *models.GetAlertsQuery) error {
				getAlertsQuery = query
				return nil
			})

			sc.handlerFunc = GetAlerts
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			require.Nil(t, searchQuery)
			assert.NotNil(t, getAlertsQuery)
		})

	loggedInUserScenarioWithRole(t, "When calling GET on", "GET",
		"/api/alerts?dashboardId=1&dashboardId=2&folderId=3&dashboardTag=abc&dashboardQuery=dbQuery&limit=5&query=alertQuery",
		"/api/alerts", models.ROLE_EDITOR, func(sc *scenarioContext) {
			setUp()

			var searchQuery *search.Query
			bus.AddHandler("test", func(query *search.Query) error {
				searchQuery = query
				query.Result = search.HitList{
					&search.Hit{ID: 1},
					&search.Hit{ID: 2},
				}
				return nil
			})

			var getAlertsQuery *models.GetAlertsQuery
			bus.AddHandler("test", func(query *models.GetAlertsQuery) error {
				getAlertsQuery = query
				return nil
			})

			sc.handlerFunc = GetAlerts
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			require.NotNil(t, searchQuery)
			assert.Equal(t, int64(1), searchQuery.DashboardIds[0])
			assert.Equal(t, int64(2), searchQuery.DashboardIds[1])
			assert.Equal(t, int64(3), searchQuery.FolderIds[0])
			assert.Equal(t, "abc", searchQuery.Tags[0])
			assert.Equal(t, "dbQuery", searchQuery.Title)

			require.NotNil(t, getAlertsQuery)
			assert.Equal(t, int64(1), getAlertsQuery.DashboardIDs[0])
			assert.Equal(t, int64(2), getAlertsQuery.DashboardIDs[1])
			assert.Equal(t, int64(5), getAlertsQuery.Limit)
			assert.Equal(t, "alertQuery", getAlertsQuery.Query)
		})

	loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/alert-notifications/1",
		"/alert-notifications/:notificationId", models.ROLE_ADMIN, func(sc *scenarioContext) {
			setUp()

			sc.handlerFunc = GetAlertNotificationByID
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
			assert.Equal(t, 404, sc.resp.Code)
		})
}

func callPauseAlert(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *models.PauseAlertCommand) error {
		return nil
	})

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func postAlertScenario(t *testing.T, desc string, url string, routePattern string, role models.RoleType,
	cmd dtos.PauseAlertCommand, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = role

			return PauseAlert(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

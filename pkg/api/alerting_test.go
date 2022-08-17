package api

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
)

var (
	viewerRole = models.ROLE_VIEWER
	editorRole = models.ROLE_EDITOR
)

type setUpConf struct {
	aclMockResp []*models.DashboardACLInfoDTO
}

type mockSearchService struct{ ExpectedResult models.HitList }

func (mss *mockSearchService) SearchHandler(_ context.Context, q *search.Query) error {
	q.Result = mss.ExpectedResult
	return nil
}
func (mss *mockSearchService) SortOptions() []models.SortOption { return nil }

func setUp(confs ...setUpConf) *HTTPServer {
	singleAlert := &models.Alert{Id: 1, DashboardId: 1, Name: "singlealert"}
	store := mockstore.NewSQLStoreMock()
	hs := &HTTPServer{SQLStore: store, SearchService: &mockSearchService{}}
	store.ExpectedAlert = singleAlert

	aclMockResp := []*models.DashboardACLInfoDTO{}
	for _, c := range confs {
		if c.aclMockResp != nil {
			aclMockResp = c.aclMockResp
		}
	}
	store.ExpectedTeamsByUser = []*models.TeamDTO{}
	dashSvc := &dashboards.FakeDashboardService{}
	dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*models.GetDashboardACLInfoListQuery")).Run(func(args mock.Arguments) {
		q := args.Get(1).(*models.GetDashboardACLInfoListQuery)
		q.Result = aclMockResp
	}).Return(nil)
	guardian.InitLegacyGuardian(store, dashSvc)
	return hs
}

func TestAlertingAPIEndpoint(t *testing.T) {
	t.Run("When user is editor and not in the ACL", func(t *testing.T) {
		hs := setUp()
		cmd := dtos.PauseAlertCommand{
			AlertId: 1,
			Paused:  true,
		}
		postAlertScenario(t, hs, "When calling POST on", "/api/alerts/1/pause", "/api/alerts/:alertId/pause",
			models.ROLE_EDITOR, cmd, func(sc *scenarioContext) {
				setUp()

				callPauseAlert(sc)
				assert.Equal(t, 403, sc.resp.Code)
			})
	})

	t.Run("When user is editor and dashboard has default ACL", func(t *testing.T) {
		hs := setUp()
		cmd := dtos.PauseAlertCommand{
			AlertId: 1,
			Paused:  true,
		}
		postAlertScenario(t, hs, "When calling POST on", "/api/alerts/1/pause", "/api/alerts/:alertId/pause",
			models.ROLE_EDITOR, cmd, func(sc *scenarioContext) {
				setUp(setUpConf{
					aclMockResp: []*models.DashboardACLInfoDTO{
						{Role: &viewerRole, Permission: models.PERMISSION_VIEW},
						{Role: &editorRole, Permission: models.PERMISSION_EDIT},
					},
				})

				callPauseAlert(sc)
				assert.Equal(t, 200, sc.resp.Code)
			})
	})

	t.Run("When calling GET", func(t *testing.T) {
		hs := setUp()
		loggedInUserScenarioWithRole(t, "When calling GET on", "GET",
			"/api/alerts?dashboardId=1&dashboardId=2&folderId=3&dashboardTag=abc&dashboardQuery=dbQuery&limit=5&query=alertQuery",
			"/api/alerts", models.ROLE_EDITOR, func(sc *scenarioContext) {
				hs.SearchService.(*mockSearchService).ExpectedResult = models.HitList{
					&models.Hit{ID: 1},
					&models.Hit{ID: 2},
				}

				sc.handlerFunc = hs.GetAlerts
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				getAlertsQuery := hs.SQLStore.(*mockstore.SQLStoreMock).LastGetAlertsQuery

				require.NotNil(t, getAlertsQuery)
				assert.Equal(t, int64(1), getAlertsQuery.DashboardIDs[0])
				assert.Equal(t, int64(2), getAlertsQuery.DashboardIDs[1])
				assert.Equal(t, int64(5), getAlertsQuery.Limit)
				assert.Equal(t, "alertQuery", getAlertsQuery.Query)
			}, hs.SQLStore)
	})

	t.Run("When calling GET on alert-notifications", func(t *testing.T) {
		hs := setUp()
		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/alert-notifications/1",
			"/alert-notifications/:notificationId", models.ROLE_ADMIN, func(sc *scenarioContext) {
				sc.handlerFunc = hs.GetAlertNotificationByID
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
				assert.Equal(t, 404, sc.resp.Code)
			}, hs.SQLStore)
	})
}

func callPauseAlert(sc *scenarioContext) {
	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func postAlertScenario(t *testing.T, hs *HTTPServer, desc string, url string, routePattern string, role models.RoleType,
	cmd dtos.PauseAlertCommand, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = role

			legacyAlertingEnabled := new(bool)
			*legacyAlertingEnabled = true
			return hs.PauseAlert(legacyAlertingEnabled)(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

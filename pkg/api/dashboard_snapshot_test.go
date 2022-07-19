package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
)

func TestDashboardSnapshotAPIEndpoint_singleSnapshot(t *testing.T) {
	setupRemoteServer := func(fn func(http.ResponseWriter, *http.Request)) *httptest.Server {
		s := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			fn(rw, r)
		}))
		t.Cleanup(s.Close)
		return s
	}

	sqlmock := mockstore.NewSQLStoreMock()
	sqlmock.ExpectedTeamsByUser = []*models.TeamDTO{}
	jsonModel, err := simplejson.NewJson([]byte(`{"id":100}`))
	require.NoError(t, err)

	setUpSnapshotTest := func(t *testing.T, userId int64, deleteUrl string) dashboardsnapshots.Service {
		t.Helper()

		dashSnapSvc := dashboardsnapshots.NewMockService(t)
		dashSnapSvc.On("DeleteDashboardSnapshot", mock.Anything, mock.AnythingOfType("*dashboardsnapshots.DeleteDashboardSnapshotCommand")).Return(nil).Maybe()
		dashSnapSvc.On("GetDashboardSnapshot", mock.Anything, mock.AnythingOfType("*dashboardsnapshots.GetDashboardSnapshotQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*dashboardsnapshots.GetDashboardSnapshotQuery)
			res := &dashboardsnapshots.DashboardSnapshot{
				Id:        1,
				Key:       "12345",
				DeleteKey: "54321",
				Dashboard: jsonModel,
				Expires:   time.Now().Add(time.Duration(1000) * time.Second),
				UserId:    999999,
			}
			if userId != 0 {
				res.UserId = userId
			}
			if deleteUrl != "" {
				res.External = true
				res.ExternalDeleteUrl = deleteUrl
			}
			q.Result = res
		}).Return(nil)
		dashSnapSvc.On("DeleteDashboardSnapshot", mock.Anything, mock.AnythingOfType("*dashboardsnapshots.DeleteDashboardSnapshotCommand")).Return(nil).Maybe()
		return dashSnapSvc
	}

	t.Run("When user has editor role and is not in the ACL", func(t *testing.T) {
		loggedInUserScenarioWithRole(t, "Should not be able to delete snapshot when calling DELETE on",
			"DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				hs := &HTTPServer{dashboardsnapshotsService: setUpSnapshotTest(t, 0, "")}
				sc.handlerFunc = hs.DeleteDashboardSnapshot

				dashSvc := dashboards.NewFakeDashboardService(t)
				dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*models.GetDashboardACLInfoListQuery")).Return(nil).Maybe()

				guardian.InitLegacyGuardian(sc.sqlStore, dashSvc)
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, 403, sc.resp.Code)
			}, sqlmock)
	})

	t.Run("When user is anonymous", func(t *testing.T) {
		anonymousUserScenario(t, "Should be able to delete a snapshot when calling GET on", "GET",
			"/api/snapshots-delete/12345", "/api/snapshots-delete/:deleteKey", func(sc *scenarioContext) {
				var externalRequest *http.Request
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(200)
					externalRequest = req
				})
				hs := &HTTPServer{dashboardsnapshotsService: setUpSnapshotTest(t, 0, ts.URL)}

				sc.handlerFunc = hs.DeleteDashboardSnapshotByDeleteKey
				sc.fakeReqWithParams("GET", sc.url, map[string]string{"deleteKey": "12345"}).exec()

				require.Equal(t, 200, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.True(t, strings.HasPrefix(respJSON.Get("message").MustString(), "Snapshot deleted"))
				assert.Equal(t, 1, respJSON.Get("id").MustInt())

				assert.Equal(t, http.MethodGet, externalRequest.Method)
				assert.Equal(t, ts.URL, fmt.Sprintf("http://%s", externalRequest.Host))
				assert.Equal(t, "/", externalRequest.URL.EscapedPath())
			})
	})

	t.Run("When user is editor and dashboard has default ACL", func(t *testing.T) {
		dashSvc := &dashboards.FakeDashboardService{}
		dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*models.GetDashboardACLInfoListQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*models.GetDashboardACLInfoListQuery)
			q.Result = []*models.DashboardACLInfoDTO{
				{Role: &viewerRole, Permission: models.PERMISSION_VIEW},
				{Role: &editorRole, Permission: models.PERMISSION_EDIT},
			}
		}).Return(nil)

		loggedInUserScenarioWithRole(t, "Should be able to delete a snapshot when calling DELETE on", "DELETE",
			"/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				guardian.InitLegacyGuardian(sc.sqlStore, dashSvc)
				var externalRequest *http.Request
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(200)
					externalRequest = req
				})
				hs := &HTTPServer{dashboardsnapshotsService: setUpSnapshotTest(t, 0, ts.URL)}
				sc.handlerFunc = hs.DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, 200, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.True(t, strings.HasPrefix(respJSON.Get("message").MustString(), "Snapshot deleted"))
				assert.Equal(t, 1, respJSON.Get("id").MustInt())
				assert.Equal(t, ts.URL, fmt.Sprintf("http://%s", externalRequest.Host))
				assert.Equal(t, "/", externalRequest.URL.EscapedPath())
			}, sqlmock)
	})

	t.Run("When user is editor and creator of the snapshot", func(t *testing.T) {
		loggedInUserScenarioWithRole(t, "Should be able to delete a snapshot when calling DELETE on",
			"DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				d := setUpSnapshotTest(t, testUserID, "")
				hs := &HTTPServer{dashboardsnapshotsService: d}

				sc.handlerFunc = hs.DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, 200, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.True(t, strings.HasPrefix(respJSON.Get("message").MustString(), "Snapshot deleted"))
				assert.Equal(t, 1, respJSON.Get("id").MustInt())
			}, sqlmock)
	})

	t.Run("When deleting an external snapshot", func(t *testing.T) {
		loggedInUserScenarioWithRole(t,
			"Should gracefully delete local snapshot when remote snapshot has already been removed when calling DELETE on",
			"DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				var writeErr error
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(500)
					_, writeErr = rw.Write([]byte(`{"message":"Failed to get dashboard snapshot"}`))
				})
				hs := &HTTPServer{dashboardsnapshotsService: setUpSnapshotTest(t, testUserID, ts.URL)}
				sc.handlerFunc = hs.DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				require.NoError(t, writeErr)
				assert.Equal(t, 200, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.True(t, strings.HasPrefix(respJSON.Get("message").MustString(), "Snapshot deleted"))
				assert.Equal(t, 1, respJSON.Get("id").MustInt())
			}, sqlmock)

		loggedInUserScenarioWithRole(t,
			"Should fail to delete local snapshot when an unexpected 500 error occurs when calling DELETE on", "DELETE",
			"/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				var writeErr error
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(500)
					_, writeErr = rw.Write([]byte(`{"message":"Unexpected"}`))
				})
				hs := &HTTPServer{dashboardsnapshotsService: setUpSnapshotTest(t, testUserID, ts.URL)}
				sc.handlerFunc = hs.DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				require.NoError(t, writeErr)
				assert.Equal(t, 500, sc.resp.Code)
			}, sqlmock)

		loggedInUserScenarioWithRole(t,
			"Should fail to delete local snapshot when an unexpected remote error occurs when calling DELETE on",
			"DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(404)
				})
				hs := &HTTPServer{dashboardsnapshotsService: setUpSnapshotTest(t, testUserID, ts.URL)}
				sc.handlerFunc = hs.DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, 500, sc.resp.Code)
			}, sqlmock)

		loggedInUserScenarioWithRole(t, "Should be able to read a snapshot's unencrypted data when calling GET on",
			"GET", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				hs := &HTTPServer{dashboardsnapshotsService: setUpSnapshotTest(t, 0, "")}
				sc.handlerFunc = hs.GetDashboardSnapshot
				sc.fakeReqWithParams("GET", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, 200, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				dashboard := respJSON.Get("dashboard")
				id := dashboard.Get("id")

				assert.Equal(t, int64(100), id.MustInt64())
			}, sqlmock)
	})
}

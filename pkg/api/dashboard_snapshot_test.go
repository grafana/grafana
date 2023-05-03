package api

import (
	"errors"
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
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func TestDashboardSnapshotAPIEndpoint_singleSnapshot(t *testing.T) {
	setupRemoteServer := func(fn func(http.ResponseWriter, *http.Request)) *httptest.Server {
		s := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			fn(rw, r)
		}))
		t.Cleanup(s.Close)
		return s
	}

	sqlmock := dbtest.NewFakeDB()
	jsonModel, err := simplejson.NewJson([]byte(`{"id":100}`))
	require.NoError(t, err)

	setUpSnapshotTest := func(t *testing.T, userId int64, deleteUrl string) dashboardsnapshots.Service {
		t.Helper()

		dashSnapSvc := dashboardsnapshots.NewMockService(t)
		dashSnapSvc.On("DeleteDashboardSnapshot", mock.Anything, mock.AnythingOfType("*dashboardsnapshots.DeleteDashboardSnapshotCommand")).Return(nil).Maybe()
		res := &dashboardsnapshots.DashboardSnapshot{
			ID:        1,
			Key:       "12345",
			DeleteKey: "54321",
			Dashboard: jsonModel,
			Expires:   time.Now().Add(time.Duration(1000) * time.Second),
			UserID:    999999,
		}
		if userId != 0 {
			res.UserID = userId
		}
		if deleteUrl != "" {
			res.External = true
			res.ExternalDeleteURL = deleteUrl
		}
		dashSnapSvc.On("GetDashboardSnapshot", mock.Anything, mock.AnythingOfType("*dashboardsnapshots.GetDashboardSnapshotQuery")).Return(res, nil)
		dashSnapSvc.On("DeleteDashboardSnapshot", mock.Anything, mock.AnythingOfType("*dashboardsnapshots.DeleteDashboardSnapshotCommand")).Return(nil).Maybe()
		return dashSnapSvc
	}

	t.Run("When user has editor role and is not in the ACL", func(t *testing.T) {
		loggedInUserScenarioWithRole(t, "Should not be able to delete snapshot when calling DELETE on",
			"DELETE", "/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
				d := setUpSnapshotTest(t, 0, "")
				hs := buildHttpServer(d, true)
				sc.handlerFunc = hs.DeleteDashboardSnapshot

				teamSvc := &teamtest.FakeService{}
				dashSvc := dashboards.NewFakeDashboardService(t)
				var qResult *dashboards.Dashboard
				dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Run(func(args mock.Arguments) {
					q := args.Get(1).(*dashboards.GetDashboardQuery)
					qResult = &dashboards.Dashboard{
						ID:  q.ID,
						UID: q.UID,
					}
				}).Return(qResult, nil).Maybe()
				dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardACLInfoListQuery")).Return(nil, nil).Maybe()
				hs.DashboardService = dashSvc

				guardian.InitLegacyGuardian(setting.NewCfg(), sc.sqlStore, dashSvc, teamSvc)
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
				d := setUpSnapshotTest(t, 0, ts.URL)
				hs := buildHttpServer(d, true)

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
		teamSvc := &teamtest.FakeService{}
		dashSvc := &dashboards.FakeDashboardService{}
		qResult := []*dashboards.DashboardACLInfoDTO{
			{Role: &viewerRole, Permission: dashboards.PERMISSION_VIEW},
			{Role: &editorRole, Permission: dashboards.PERMISSION_EDIT},
		}
		dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardACLInfoListQuery")).Return(qResult, nil)

		loggedInUserScenarioWithRole(t, "Should not be able to delete a snapshot when fetching guardian fails during calling DELETE on", "DELETE",
			"/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(200)
				})
				dashSvc := dashboards.NewFakeDashboardService(t)
				dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(nil, errutil.Error{PublicMessage: "some error"}).Maybe()

				guardian.InitLegacyGuardian(sc.cfg, sc.sqlStore, dashSvc, teamSvc)
				d := setUpSnapshotTest(t, 0, ts.URL)
				hs := buildHttpServer(d, true)
				hs.DashboardService = dashSvc
				sc.handlerFunc = hs.DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, http.StatusInternalServerError, sc.resp.Code)
			}, sqlmock)

		loggedInUserScenarioWithRole(t, "Should be able to delete a snapshot from a deleted dashboard when calling DELETE on", "DELETE",
			"/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
				var externalRequest *http.Request
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(200)
					externalRequest = req
				})
				dashSvc := dashboards.NewFakeDashboardService(t)
				dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(nil, dashboards.ErrDashboardNotFound).Maybe()

				guardian.InitLegacyGuardian(sc.cfg, sc.sqlStore, dashSvc, teamSvc)
				d := setUpSnapshotTest(t, 0, ts.URL)
				hs := buildHttpServer(d, true)
				hs.DashboardService = dashSvc
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

		loggedInUserScenarioWithRole(t, "Should be able to delete a snapshot when calling DELETE on", "DELETE",
			"/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
				var externalRequest *http.Request
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(200)
					externalRequest = req
				})
				dashSvc := dashboards.NewFakeDashboardService(t)
				qResult := &dashboards.Dashboard{}
				dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(qResult, nil).Maybe()
				qResultACL := []*dashboards.DashboardACLInfoDTO{
					{Role: &viewerRole, Permission: dashboards.PERMISSION_VIEW},
					{Role: &editorRole, Permission: dashboards.PERMISSION_EDIT},
				}
				dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardACLInfoListQuery")).Return(qResultACL, nil)
				guardian.InitLegacyGuardian(sc.cfg, sc.sqlStore, dashSvc, teamSvc)
				d := setUpSnapshotTest(t, 0, ts.URL)
				hs := buildHttpServer(d, true)
				hs.DashboardService = dashSvc
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
			"DELETE", "/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
				d := setUpSnapshotTest(t, testUserID, "")

				dashSvc := dashboards.NewFakeDashboardService(t)
				hs := buildHttpServer(d, true)
				hs.DashboardService = dashSvc
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
			"DELETE", "/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
				var writeErr error
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(500)
					_, writeErr = rw.Write([]byte(`{"message":"Failed to get dashboard snapshot"}`))
				})

				dashSvc := dashboards.NewFakeDashboardService(t)
				d := setUpSnapshotTest(t, testUserID, ts.URL)
				hs := buildHttpServer(d, true)
				hs.DashboardService = dashSvc
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
			"/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
				var writeErr error
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(500)
					_, writeErr = rw.Write([]byte(`{"message":"Unexpected"}`))
				})
				d := setUpSnapshotTest(t, testUserID, ts.URL)
				hs := buildHttpServer(d, true)
				sc.handlerFunc = hs.DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				require.NoError(t, writeErr)
				assert.Equal(t, 500, sc.resp.Code)
			}, sqlmock)

		loggedInUserScenarioWithRole(t,
			"Should fail to delete local snapshot when an unexpected remote error occurs when calling DELETE on",
			"DELETE", "/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(404)
				})
				d := setUpSnapshotTest(t, testUserID, ts.URL)
				hs := buildHttpServer(d, true)
				sc.handlerFunc = hs.DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, 500, sc.resp.Code)
			}, sqlmock)

		loggedInUserScenarioWithRole(t, "Should be able to read a snapshot's unencrypted data when calling GET on",
			"GET", "/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
				d := setUpSnapshotTest(t, 0, "")
				hs := buildHttpServer(d, true)
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

func TestGetDashboardSnapshotNotFound(t *testing.T) {
	sqlmock := dbtest.NewFakeDB()

	setUpSnapshotTest := func(t *testing.T) dashboardsnapshots.Service {
		t.Helper()

		dashSnapSvc := dashboardsnapshots.NewMockService(t)
		dashSnapSvc.
			On("GetDashboardSnapshot", mock.Anything, mock.AnythingOfType("*dashboardsnapshots.GetDashboardSnapshotQuery")).
			Run(func(args mock.Arguments) {}).
			Return(nil, dashboardsnapshots.ErrBaseNotFound.Errorf(""))

		return dashSnapSvc
	}

	loggedInUserScenarioWithRole(t,
		"GET /snapshots/{key} should return 404 when the snapshot does not exist", "GET",
		"/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
			d := setUpSnapshotTest(t)
			hs := buildHttpServer(d, true)
			sc.handlerFunc = hs.GetDashboardSnapshot
			sc.fakeReqWithParams("GET", sc.url, map[string]string{"key": "12345"}).exec()

			assert.Equal(t, http.StatusNotFound, sc.resp.Code)
		}, sqlmock)

	loggedInUserScenarioWithRole(t,
		"DELETE /snapshots/{key} should return 404 when the snapshot does not exist", "DELETE",
		"/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
			d := setUpSnapshotTest(t)
			hs := buildHttpServer(d, true)
			sc.handlerFunc = hs.DeleteDashboardSnapshot
			sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

			assert.Equal(t, http.StatusNotFound, sc.resp.Code)
		}, sqlmock)

	loggedInUserScenarioWithRole(t,
		"GET /snapshots-delete/{deleteKey} should return 404 when the snapshot does not exist", "DELETE",
		"/api/snapshots-delete/12345", "/api/snapshots-delete/:deleteKey", org.RoleEditor, func(sc *scenarioContext) {
			d := setUpSnapshotTest(t)
			hs := buildHttpServer(d, true)
			sc.handlerFunc = hs.DeleteDashboardSnapshotByDeleteKey
			sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"deleteKey": "12345"}).exec()

			assert.Equal(t, http.StatusNotFound, sc.resp.Code)
		}, sqlmock)
}

func TestGetDashboardSnapshotFailure(t *testing.T) {
	sqlmock := dbtest.NewFakeDB()

	setUpSnapshotTest := func(t *testing.T, shouldMockDashSnapServ bool) dashboardsnapshots.Service {
		t.Helper()

		if shouldMockDashSnapServ {
			dashSnapSvc := dashboardsnapshots.NewMockService(t)
			dashSnapSvc.
				On("GetDashboardSnapshot", mock.Anything, mock.AnythingOfType("*dashboardsnapshots.GetDashboardSnapshotQuery")).
				Run(func(args mock.Arguments) {}).
				Return(nil, errors.New("something went wrong"))
			return dashSnapSvc
		} else {
			return nil
		}
	}

	loggedInUserScenarioWithRole(t,
		"GET /snapshots/{key} should return 404 when the snapshot does not exist", "GET",
		"/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
			d := setUpSnapshotTest(t, true)
			hs := buildHttpServer(d, true)
			sc.handlerFunc = hs.GetDashboardSnapshot
			sc.fakeReqWithParams("GET", sc.url, map[string]string{"key": "12345"}).exec()

			assert.Equal(t, http.StatusInternalServerError, sc.resp.Code)
		}, sqlmock)

	loggedInUserScenarioWithRole(t,
		"GET /snapshots/{key} should return 403 when snapshot is disabled", "GET",
		"/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
			d := setUpSnapshotTest(t, false)
			hs := buildHttpServer(d, false)
			sc.handlerFunc = hs.GetDashboardSnapshot
			sc.fakeReqWithParams("GET", sc.url, map[string]string{"key": "12345"}).exec()

			assert.Equal(t, http.StatusForbidden, sc.resp.Code)
		}, sqlmock)

	loggedInUserScenarioWithRole(t,
		"DELETE /snapshots/{key} should return 404 when the snapshot does not exist", "DELETE",
		"/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
			d := setUpSnapshotTest(t, true)
			hs := buildHttpServer(d, true)
			sc.handlerFunc = hs.DeleteDashboardSnapshot
			sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

			assert.Equal(t, http.StatusInternalServerError, sc.resp.Code)
		}, sqlmock)

	loggedInUserScenarioWithRole(t,
		"DELETE /snapshots/{key} should return 403 when snapshot is disabled", "DELETE",
		"/api/snapshots/12345", "/api/snapshots/:key", org.RoleEditor, func(sc *scenarioContext) {
			d := setUpSnapshotTest(t, false)
			hs := buildHttpServer(d, false)
			sc.handlerFunc = hs.DeleteDashboardSnapshot
			sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

			assert.Equal(t, http.StatusForbidden, sc.resp.Code)
		}, sqlmock)

	loggedInUserScenarioWithRole(t,
		"GET /snapshots-delete/{deleteKey} should return 404 when the snapshot does not exist", "DELETE",
		"/api/snapshots-delete/12345", "/api/snapshots-delete/:deleteKey", org.RoleEditor, func(sc *scenarioContext) {
			d := setUpSnapshotTest(t, true)
			hs := buildHttpServer(d, true)
			sc.handlerFunc = hs.DeleteDashboardSnapshotByDeleteKey
			sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"deleteKey": "12345"}).exec()

			assert.Equal(t, http.StatusInternalServerError, sc.resp.Code)
		}, sqlmock)

	loggedInUserScenarioWithRole(t,
		"GET /snapshots-delete/{deleteKey} should return 403 when snapshot is disabled", "DELETE",
		"/api/snapshots-delete/12345", "/api/snapshots-delete/:deleteKey", org.RoleEditor, func(sc *scenarioContext) {
			d := setUpSnapshotTest(t, false)
			hs := buildHttpServer(d, false)
			sc.handlerFunc = hs.DeleteDashboardSnapshotByDeleteKey
			sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"deleteKey": "12345"}).exec()

			assert.Equal(t, http.StatusForbidden, sc.resp.Code)
		}, sqlmock)
}

func buildHttpServer(d dashboardsnapshots.Service, snapshotEnabled bool) *HTTPServer {
	hs := &HTTPServer{
		dashboardsnapshotsService: d,
		Cfg: &setting.Cfg{
			SnapshotEnabled: snapshotEnabled,
		},
	}
	return hs
}

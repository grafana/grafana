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
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestHTTPServer_DeleteDashboardSnapshot(t *testing.T) {
	setup := func(t *testing.T, svc dashboards.DashboardService, userID int64, deleteURL string) *webtest.Server {
		t.Helper()

		return SetupAPITestServer(t, func(hs *HTTPServer) {
			cfg := setting.NewCfg()
			cfg.SnapshotEnabled = true
			hs.Cfg = cfg
			hs.dashboardsnapshotsService = setUpSnapshotTest(t, userID, deleteURL)

			hs.DashboardService = svc

			hs.AccessControl = acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient())
			guardian.InitAccessControlGuardian(hs.Cfg, hs.AccessControl, hs.DashboardService)
		})
	}

	allowedUser := userWithPermissions(1, []accesscontrol.Permission{
		{Action: dashboards.ActionDashboardsWrite, Scope: "dashboards:uid:1"},
		{Action: dashboards.ActionSnapshotsDelete},
	})

	t.Run("User should not be able to delete snapshot without permissions", func(t *testing.T) {
		svc := dashboards.NewFakeDashboardService(t)
		server := setup(t, svc, 0, "")

		res, err := server.Send(webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodDelete, "/api/snapshots/12345", nil),
			&user.SignedInUser{UserID: 1, OrgID: 1},
		))

		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("User should be able to delete snapshot with correct permissions", func(t *testing.T) {
		svc := dashboards.NewFakeDashboardService(t)
		svc.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{UID: "1"}, nil)

		server := setup(t, svc, 0, "")
		res, err := server.Send(webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodDelete, "/api/snapshots/12345", nil),
			allowedUser,
		))

		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("User should not be able to delete snapshot if fetching dashboard fails", func(t *testing.T) {
		svc := dashboards.NewFakeDashboardService(t)
		svc.On("GetDashboard", mock.Anything, mock.Anything).Return(nil, errors.New("some-error"))

		server := setup(t, svc, 0, "")
		res, err := server.Send(webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodDelete, "/api/snapshots/12345", nil),
			allowedUser,
		))

		require.NoError(t, err)
		assert.Equal(t, http.StatusInternalServerError, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("User should be able to delete snapshot if connected dashboard no longer exists", func(t *testing.T) {
		svc := dashboards.NewFakeDashboardService(t)
		svc.On("GetDashboard", mock.Anything, mock.Anything).Return(nil, dashboards.ErrDashboardNotFound)

		server := setup(t, svc, 0, "")
		res, err := server.Send(webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodDelete, "/api/snapshots/12345", nil),
			allowedUser,
		))

		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("User should be able to delete when user is creator but does not have permissions to edit dashboard", func(t *testing.T) {
		svc := dashboards.NewFakeDashboardService(t)
		svc.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{UID: "1"}, nil)

		server := setup(t, svc, 1, "")
		res, err := server.Send(webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodDelete, "/api/snapshots/12345", nil),
			allowedUser,
		))

		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestDashboardSnapshotAPIEndpoint_singleSnapshot(t *testing.T) {
	setupRemoteServer := func(fn func(http.ResponseWriter, *http.Request)) *httptest.Server {
		s := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			fn(rw, r)
		}))
		t.Cleanup(s.Close)
		return s
	}

	sqlmock := dbtest.NewFakeDB()

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

				require.Equal(t, 200, sc.resp.Code, "BODY: "+sc.resp.Body.String())
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.True(t, strings.HasPrefix(respJSON.Get("message").MustString(), "Snapshot deleted"))

				assert.Equal(t, http.MethodGet, externalRequest.Method)
				assert.Equal(t, ts.URL, fmt.Sprintf("http://%s", externalRequest.Host))
				assert.Equal(t, "/", externalRequest.URL.EscapedPath())
			})
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

			assert.Equal(t, http.StatusNotFound, sc.resp.Code, "BODY: "+sc.resp.Body.String())
		}, sqlmock)

	loggedInUserScenarioWithRole(t,
		"GET /snapshots-delete/{deleteKey} should return 404 when the snapshot does not exist", "DELETE",
		"/api/snapshots-delete/12345", "/api/snapshots-delete/:deleteKey", org.RoleEditor, func(sc *scenarioContext) {
			d := setUpSnapshotTest(t)
			hs := buildHttpServer(d, true)
			sc.handlerFunc = hs.DeleteDashboardSnapshotByDeleteKey
			sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"deleteKey": "12345"}).exec()

			assert.Equal(t, http.StatusNotFound, sc.resp.Code, "BODY: "+sc.resp.Body.String())
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

			assert.Equal(t, http.StatusForbidden, sc.resp.Code, "BODY: "+sc.resp.Body.String())
		}, sqlmock)

	loggedInUserScenarioWithRole(t,
		"GET /snapshots-delete/{deleteKey} should return 404 when the snapshot does not exist", "DELETE",
		"/api/snapshots-delete/12345", "/api/snapshots-delete/:deleteKey", org.RoleEditor, func(sc *scenarioContext) {
			d := setUpSnapshotTest(t, true)
			hs := buildHttpServer(d, true)
			sc.handlerFunc = hs.DeleteDashboardSnapshotByDeleteKey
			sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"deleteKey": "12345"}).exec()

			assert.Equal(t, http.StatusInternalServerError, sc.resp.Code, "BODY: "+sc.resp.Body.String())
		}, sqlmock)

	loggedInUserScenarioWithRole(t,
		"GET /snapshots-delete/{deleteKey} should return 403 when snapshot is disabled", "DELETE",
		"/api/snapshots-delete/12345", "/api/snapshots-delete/:deleteKey", org.RoleEditor, func(sc *scenarioContext) {
			d := setUpSnapshotTest(t, false)
			hs := buildHttpServer(d, false)
			sc.handlerFunc = hs.DeleteDashboardSnapshotByDeleteKey
			sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"deleteKey": "12345"}).exec()

			assert.Equal(t, http.StatusForbidden, sc.resp.Code, "BODY: "+sc.resp.Body.String())
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
func setUpSnapshotTest(t *testing.T, userId int64, deleteUrl string) dashboardsnapshots.Service {
	t.Helper()

	dashSnapSvc := dashboardsnapshots.NewMockService(t)
	dashSnapSvc.On("DeleteDashboardSnapshot", mock.Anything, mock.AnythingOfType("*dashboardsnapshots.DeleteDashboardSnapshotCommand")).Return(nil).Maybe()

	jsonModel, err := simplejson.NewJson([]byte(`{"id":100}`))
	require.NoError(t, err)

	res := &dashboardsnapshots.DashboardSnapshot{
		ID:        1,
		OrgID:     1,
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
	dashSnapSvc.On("GetDashboardSnapshot", mock.Anything, mock.AnythingOfType("*dashboardsnapshots.GetDashboardSnapshotQuery")).Return(res, nil).Maybe()
	dashSnapSvc.On("DeleteDashboardSnapshot", mock.Anything, mock.AnythingOfType("*dashboardsnapshots.DeleteDashboardSnapshotCommand")).Return(nil).Maybe()
	return dashSnapSvc
}

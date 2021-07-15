package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/securedata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDashboardSnapshotAPIEndpoint_singleSnapshot(t *testing.T) {
	setupRemoteServer := func(fn func(http.ResponseWriter, *http.Request)) *httptest.Server {
		s := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			fn(rw, r)
		}))
		t.Cleanup(s.Close)
		return s
	}

	jsonModel, err := simplejson.NewJson([]byte(`{"id":100}`))
	require.NoError(t, err)

	viewerRole := models.ROLE_VIEWER
	editorRole := models.ROLE_EDITOR
	aclMockResp := []*models.DashboardAclInfoDTO{}

	setUpSnapshotTest := func(t *testing.T) *models.DashboardSnapshot {
		t.Helper()

		mockSnapshotResult := &models.DashboardSnapshot{
			Id:        1,
			Key:       "12345",
			DeleteKey: "54321",
			Dashboard: jsonModel,
			Expires:   time.Now().Add(time.Duration(1000) * time.Second),
			UserId:    999999,
			External:  true,
		}

		bus.AddHandler("test", func(query *models.GetDashboardSnapshotQuery) error {
			query.Result = mockSnapshotResult
			return nil
		})

		bus.AddHandler("test", func(cmd *models.DeleteDashboardSnapshotCommand) error {
			return nil
		})

		bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
			query.Result = aclMockResp
			return nil
		})

		teamResp := []*models.TeamDTO{}
		bus.AddHandler("test", func(query *models.GetTeamsByUserQuery) error {
			query.Result = teamResp
			return nil
		})

		return mockSnapshotResult
	}

	t.Run("When user has editor role and is not in the ACL", func(t *testing.T) {
		loggedInUserScenarioWithRole(t, "Should not be able to delete snapshot when calling DELETE on",
			"DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				mockSnapshotResult := setUpSnapshotTest(t)

				var externalRequest *http.Request
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					externalRequest = req
				})

				mockSnapshotResult.ExternalDeleteUrl = ts.URL
				sc.handlerFunc = DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, 403, sc.resp.Code)
				require.Nil(t, externalRequest)
			})
	})

	t.Run("When user is anonymous", func(t *testing.T) {
		anonymousUserScenario(t, "Should be able to delete a snapshot when calling GET on", "GET",
			"/api/snapshots-delete/12345", "/api/snapshots-delete/:deleteKey", func(sc *scenarioContext) {
				mockSnapshotResult := setUpSnapshotTest(t)

				var externalRequest *http.Request
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(200)
					externalRequest = req
				})

				mockSnapshotResult.ExternalDeleteUrl = ts.URL
				sc.handlerFunc = DeleteDashboardSnapshotByDeleteKey
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
		aclMockResp = []*models.DashboardAclInfoDTO{
			{Role: &viewerRole, Permission: models.PERMISSION_VIEW},
			{Role: &editorRole, Permission: models.PERMISSION_EDIT},
		}

		loggedInUserScenarioWithRole(t, "Should be able to delete a snapshot when calling DELETE on", "DELETE",
			"/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				mockSnapshotResult := setUpSnapshotTest(t)

				var externalRequest *http.Request
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(200)
					externalRequest = req
				})

				mockSnapshotResult.ExternalDeleteUrl = ts.URL
				sc.handlerFunc = DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, 200, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.True(t, strings.HasPrefix(respJSON.Get("message").MustString(), "Snapshot deleted"))
				assert.Equal(t, 1, respJSON.Get("id").MustInt())
				assert.Equal(t, ts.URL, fmt.Sprintf("http://%s", externalRequest.Host))
				assert.Equal(t, "/", externalRequest.URL.EscapedPath())
			})
	})

	t.Run("When user is editor and creator of the snapshot", func(t *testing.T) {
		aclMockResp = []*models.DashboardAclInfoDTO{}
		loggedInUserScenarioWithRole(t, "Should be able to delete a snapshot when calling DELETE on",
			"DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				mockSnapshotResult := setUpSnapshotTest(t)

				mockSnapshotResult.UserId = testUserID
				mockSnapshotResult.External = false

				sc.handlerFunc = DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, 200, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.True(t, strings.HasPrefix(respJSON.Get("message").MustString(), "Snapshot deleted"))
				assert.Equal(t, 1, respJSON.Get("id").MustInt())
			})
	})

	t.Run("When deleting an external snapshot", func(t *testing.T) {
		aclMockResp = []*models.DashboardAclInfoDTO{}
		loggedInUserScenarioWithRole(t,
			"Should gracefully delete local snapshot when remote snapshot has already been removed when calling DELETE on",
			"DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				mockSnapshotResult := setUpSnapshotTest(t)
				mockSnapshotResult.UserId = testUserID

				var writeErr error
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(500)
					_, writeErr = rw.Write([]byte(`{"message":"Failed to get dashboard snapshot"}`))
				})

				mockSnapshotResult.ExternalDeleteUrl = ts.URL
				sc.handlerFunc = DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				require.NoError(t, writeErr)
				assert.Equal(t, 200, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.True(t, strings.HasPrefix(respJSON.Get("message").MustString(), "Snapshot deleted"))
				assert.Equal(t, 1, respJSON.Get("id").MustInt())
			})

		loggedInUserScenarioWithRole(t,
			"Should fail to delete local snapshot when an unexpected 500 error occurs when calling DELETE on", "DELETE",
			"/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				mockSnapshotResult := setUpSnapshotTest(t)
				mockSnapshotResult.UserId = testUserID

				var writeErr error
				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(500)
					_, writeErr = rw.Write([]byte(`{"message":"Unexpected"}`))
				})

				t.Log("Setting external delete URL", "url", ts.URL)
				mockSnapshotResult.ExternalDeleteUrl = ts.URL
				sc.handlerFunc = DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				require.NoError(t, writeErr)
				assert.Equal(t, 500, sc.resp.Code)
			})

		loggedInUserScenarioWithRole(t,
			"Should fail to delete local snapshot when an unexpected remote error occurs when calling DELETE on",
			"DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				mockSnapshotResult := setUpSnapshotTest(t)
				mockSnapshotResult.UserId = testUserID

				ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
					rw.WriteHeader(404)
				})

				mockSnapshotResult.ExternalDeleteUrl = ts.URL
				sc.handlerFunc = DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, 500, sc.resp.Code)
			})

		loggedInUserScenarioWithRole(t, "Should be able to read a snapshot's unencrypted data when calling GET on",
			"GET", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				setUpSnapshotTest(t)

				sc.handlerFunc = GetDashboardSnapshot
				sc.fakeReqWithParams("GET", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, 200, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				dashboard := respJSON.Get("dashboard")
				id := dashboard.Get("id")

				assert.Equal(t, int64(100), id.MustInt64())
			})

		loggedInUserScenarioWithRole(t, "Should be able to read a snapshot's encrypted data When calling GET on",
			"GET", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				origSecret := setting.SecretKey
				setting.SecretKey = "dashboard_snapshot_api_test"
				t.Cleanup(func() {
					setting.SecretKey = origSecret
				})

				const dashboardID int64 = 123
				jsonModel, err := simplejson.NewJson([]byte(fmt.Sprintf(`{"id":%d}`, dashboardID)))
				require.NoError(t, err)

				jsonModelEncoded, err := jsonModel.Encode()
				require.NoError(t, err)

				encrypted, err := securedata.Encrypt(jsonModelEncoded)
				require.NoError(t, err)

				// mock snapshot with encrypted dashboard info
				mockSnapshotResult := &models.DashboardSnapshot{
					Key:                "12345",
					DashboardEncrypted: encrypted,
					Expires:            time.Now().Add(time.Duration(1000) * time.Second),
				}

				setUpSnapshotTest(t)

				bus.AddHandler("test", func(query *models.GetDashboardSnapshotQuery) error {
					query.Result = mockSnapshotResult
					return nil
				})

				sc.handlerFunc = GetDashboardSnapshot
				sc.fakeReqWithParams("GET", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, 200, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, dashboardID, respJSON.Get("dashboard").Get("id").MustInt64())
			})
	})
}

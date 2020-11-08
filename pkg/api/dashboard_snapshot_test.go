package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/securedata"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDashboardSnapshotApiEndpoint(t *testing.T) {
	var externalRequest *http.Request
	jsonModel, err := simplejson.NewJson([]byte(`{"id":100}`))
	require.NoError(t, err)

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

	viewerRole := models.ROLE_VIEWER
	editorRole := models.ROLE_EDITOR
	aclMockResp := []*models.DashboardAclInfoDTO{}
	bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
		query.Result = aclMockResp
		return nil
	})

	teamResp := []*models.TeamDTO{}
	bus.AddHandler("test", func(query *models.GetTeamsByUserQuery) error {
		query.Result = teamResp
		return nil
	})

	setupRemoteServer := func(fn func(http.ResponseWriter, *http.Request)) *httptest.Server {
		return httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			fn(rw, r)
		}))
	}

	t.Run("When user has editor role and is not in the ACL", func(t *testing.T) {
		loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/snapshots/12345",
			"/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
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
		anonymousUserScenario(t, "When calling GET on", "GET", "/api/snapshots-delete/12345", "/api/snapshots-delete/:deleteKey", func(sc *scenarioContext) {
			ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
				rw.WriteHeader(200)
				externalRequest = req
			})

			mockSnapshotResult.ExternalDeleteUrl = ts.URL
			sc.handlerFunc = DeleteDashboardSnapshotByDeleteKey
			sc.fakeReqWithParams("GET", sc.url, map[string]string{"deleteKey": "12345"}).exec()

			assert.Equal(t, 200, sc.resp.Code)
			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			require.NoError(t, err)

			assert.True(t, strings.HasPrefix(respJSON.Get("message").MustString(), "Snapshot deleted"))

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

		loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/snapshots/12345",
			"/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
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
				assert.Equal(t, ts.URL, fmt.Sprintf("http://%s", externalRequest.Host))
				assert.Equal(t, "/", externalRequest.URL.EscapedPath())
			})
	})

	t.Run("When user is editor and is the creator of the snapshot", func(t *testing.T) {
		aclMockResp = []*models.DashboardAclInfoDTO{}
		mockSnapshotResult.UserId = TestUserID
		mockSnapshotResult.External = false

		loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/snapshots/12345",
			"/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
				sc.handlerFunc = DeleteDashboardSnapshot
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

				assert.Equal(t, 200, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.True(t, strings.HasPrefix(respJSON.Get("message").MustString(), "Snapshot deleted"))
			})
	})

	t.Run("When deleting an external snapshot", func(t *testing.T) {
		aclMockResp = []*models.DashboardAclInfoDTO{}
		mockSnapshotResult.UserId = TestUserID

		t.Run("Should gracefully delete local snapshot when remote snapshot has already been removed", func(t *testing.T) {
			var writeErr error
			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/snapshots/12345",
				"/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
					ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
						_, writeErr = rw.Write([]byte(`{"message":"Failed to get dashboard snapshot"}`))
						rw.WriteHeader(500)
					})

					mockSnapshotResult.ExternalDeleteUrl = ts.URL
					sc.handlerFunc = DeleteDashboardSnapshot
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

					require.NoError(t, writeErr)
					assert.Equal(t, 200, sc.resp.Code)
				})
		})

		t.Run("Should fail to delete local snapshot when an unexpected 500 error occurs", func(t *testing.T) {
			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/snapshots/12345",
				"/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
					var writeErr error
					ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
						rw.WriteHeader(500)
						_, writeErr = rw.Write([]byte(`{"message":"Unexpected"}`))
					})

					mockSnapshotResult.ExternalDeleteUrl = ts.URL
					sc.handlerFunc = DeleteDashboardSnapshot
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

					require.NoError(t, writeErr)
					assert.Equal(t, 500, sc.resp.Code)
				})
		})

		t.Run("Should fail to delete local snapshot when an unexpected remote error occurs", func(t *testing.T) {
			loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/snapshots/12345",
				"/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
					ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
						rw.WriteHeader(404)
					})

					mockSnapshotResult.ExternalDeleteUrl = ts.URL
					sc.handlerFunc = DeleteDashboardSnapshot
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

					assert.Equal(t, 500, sc.resp.Code)
				})
		})

		t.Run("Should be able to read a snapshot's un-encrypted data", func(t *testing.T) {
			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/snapshots/12345",
				"/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
					sc.handlerFunc = GetDashboardSnapshot
					sc.fakeReqWithParams("GET", sc.url, map[string]string{"key": "12345"}).exec()

					assert.Equal(t, 200, sc.resp.Code)
					respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
					require.NoError(t, err)

					dashboard := respJSON.Get("dashboard")
					id := dashboard.Get("id")

					assert.Equal(t, 100, id.MustInt64())
				})
		})

		t.Run("Should be able to read a snapshot's encrypted data", func(t *testing.T) {
			origSecret := setting.SecretKey
			setting.SecretKey = "dashboard_snapshot_api_test"
			t.Cleanup(func() {
				setting.SecretKey = origSecret
			})

			dashboardId := 123
			jsonModel, err := simplejson.NewJson([]byte(fmt.Sprintf(`{"id":%d}`, dashboardId)))
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

			bus.AddHandler("test", func(query *models.GetDashboardSnapshotQuery) error {
				query.Result = mockSnapshotResult
				return nil
			})

			loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "/api/snapshots/12345",
				"/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
					sc.handlerFunc = GetDashboardSnapshot
					sc.fakeReqWithParams("GET", sc.url, map[string]string{"key": "12345"}).exec()

					assert.Equal(t, 200, sc.resp.Code)
					respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
					require.NoError(t, err)
					assert.Equal(t, dashboardId, respJSON.Get("dashboard").Get("id").MustInt64())
				})
		})
	})
}

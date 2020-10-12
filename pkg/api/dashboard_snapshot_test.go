package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/securedata"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"

	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardSnapshotApiEndpoint(t *testing.T) {
	Convey("Given a single snapshot", t, func() {
		var externalRequest *http.Request
		jsonModel, _ := simplejson.NewJson([]byte(`{"id":100}`))

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

		Convey("When user has editor role and is not in the ACL", func() {
			Convey("Should not be able to delete snapshot", func() {
				loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
					ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
						externalRequest = req
					})

					mockSnapshotResult.ExternalDeleteUrl = ts.URL
					sc.handlerFunc = DeleteDashboardSnapshot
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

					So(sc.resp.Code, ShouldEqual, 403)
					So(externalRequest, ShouldBeNil)
				})
			})
		})

		Convey("When user is anonymous", func() {
			Convey("Should be able to delete snapshot by deleteKey", func() {
				anonymousUserScenario("When calling GET on", "GET", "/api/snapshots-delete/12345", "/api/snapshots-delete/:deleteKey", func(sc *scenarioContext) {
					ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
						rw.WriteHeader(200)
						externalRequest = req
					})

					mockSnapshotResult.ExternalDeleteUrl = ts.URL
					sc.handlerFunc = DeleteDashboardSnapshotByDeleteKey
					sc.fakeReqWithParams("GET", sc.url, map[string]string{"deleteKey": "12345"}).exec()

					So(sc.resp.Code, ShouldEqual, 200)
					respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
					So(err, ShouldBeNil)

					So(respJSON.Get("message").MustString(), ShouldStartWith, "Snapshot deleted")

					So(externalRequest.Method, ShouldEqual, http.MethodGet)
					So(fmt.Sprintf("http://%s", externalRequest.Host), ShouldEqual, ts.URL)
					So(externalRequest.URL.EscapedPath(), ShouldEqual, "/")
				})
			})
		})

		Convey("When user is editor and dashboard has default ACL", func() {
			aclMockResp = []*models.DashboardAclInfoDTO{
				{Role: &viewerRole, Permission: models.PERMISSION_VIEW},
				{Role: &editorRole, Permission: models.PERMISSION_EDIT},
			}

			Convey("Should be able to delete a snapshot", func() {
				loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
					ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
						rw.WriteHeader(200)
						externalRequest = req
					})

					mockSnapshotResult.ExternalDeleteUrl = ts.URL
					sc.handlerFunc = DeleteDashboardSnapshot
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

					So(sc.resp.Code, ShouldEqual, 200)
					respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
					So(err, ShouldBeNil)

					So(respJSON.Get("message").MustString(), ShouldStartWith, "Snapshot deleted")
					So(fmt.Sprintf("http://%s", externalRequest.Host), ShouldEqual, ts.URL)
					So(externalRequest.URL.EscapedPath(), ShouldEqual, "/")
				})
			})
		})

		Convey("When user is editor and is the creator of the snapshot", func() {
			aclMockResp = []*models.DashboardAclInfoDTO{}
			mockSnapshotResult.UserId = TestUserID
			mockSnapshotResult.External = false

			Convey("Should be able to delete a snapshot", func() {
				loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
					sc.handlerFunc = DeleteDashboardSnapshot
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

					So(sc.resp.Code, ShouldEqual, 200)
					respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
					So(err, ShouldBeNil)

					So(respJSON.Get("message").MustString(), ShouldStartWith, "Snapshot deleted")
				})
			})
		})

		Convey("When deleting an external snapshot", func() {
			aclMockResp = []*models.DashboardAclInfoDTO{}
			mockSnapshotResult.UserId = TestUserID

			Convey("Should gracefully delete local snapshot when remote snapshot has already been removed", func() {
				var writeErr error
				loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
					ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
						_, writeErr = rw.Write([]byte(`{"message":"Failed to get dashboard snapshot"}`))
						rw.WriteHeader(500)
					})

					mockSnapshotResult.ExternalDeleteUrl = ts.URL
					sc.handlerFunc = DeleteDashboardSnapshot
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

					So(writeErr, ShouldBeNil)
					So(sc.resp.Code, ShouldEqual, 200)
				})
			})

			Convey("Should fail to delete local snapshot when an unexpected 500 error occurs", func() {
				loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
					var writeErr error
					ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
						rw.WriteHeader(500)
						_, writeErr = rw.Write([]byte(`{"message":"Unexpected"}`))
					})

					mockSnapshotResult.ExternalDeleteUrl = ts.URL
					sc.handlerFunc = DeleteDashboardSnapshot
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

					So(writeErr, ShouldBeNil)
					So(sc.resp.Code, ShouldEqual, 500)
				})
			})

			Convey("Should fail to delete local snapshot when an unexpected remote error occurs", func() {
				loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
					ts := setupRemoteServer(func(rw http.ResponseWriter, req *http.Request) {
						rw.WriteHeader(404)
					})

					mockSnapshotResult.ExternalDeleteUrl = ts.URL
					sc.handlerFunc = DeleteDashboardSnapshot
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

					So(sc.resp.Code, ShouldEqual, 500)
				})
			})

			Convey("Should be able to read a snapshot's un-encrypted data", func() {
				loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
					sc.handlerFunc = GetDashboardSnapshot
					sc.fakeReqWithParams("GET", sc.url, map[string]string{"key": "12345"}).exec()

					So(sc.resp.Code, ShouldEqual, 200)
					respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
					So(err, ShouldBeNil)

					dashboard := respJSON.Get("dashboard")
					id := dashboard.Get("id")

					So(id.MustInt64(), ShouldEqual, 100)
				})
			})

			Convey("Should be able to read a snapshot's encrypted data", func() {
				origSecret := setting.SecretKey
				setting.SecretKey = "dashboard_snapshot_api_test"
				t.Cleanup(func() {
					setting.SecretKey = origSecret
				})

				dashboardId := 123
				jsonModel, err := simplejson.NewJson([]byte(fmt.Sprintf(`{"id":%d}`, dashboardId)))
				So(err, ShouldBeNil)

				jsonModelEncoded, err := jsonModel.Encode()
				So(err, ShouldBeNil)

				encrypted, err := securedata.Encrypt(jsonModelEncoded)
				So(err, ShouldBeNil)

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

				loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/snapshots/12345", "/api/snapshots/:key", models.ROLE_EDITOR, func(sc *scenarioContext) {
					sc.handlerFunc = GetDashboardSnapshot
					sc.fakeReqWithParams("GET", sc.url, map[string]string{"key": "12345"}).exec()

					So(sc.resp.Code, ShouldEqual, 200)
					respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
					So(err, ShouldBeNil)
					So(respJSON.Get("dashboard").Get("id").MustInt64(), ShouldEqual, dashboardId)
				})
			})
		})
	})
}

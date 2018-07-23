package api

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardSnapshotApiEndpoint(t *testing.T) {
	Convey("Given a single snapshot", t, func() {
		jsonModel, _ := simplejson.NewJson([]byte(`{"id":100}`))

		mockSnapshotResult := &m.DashboardSnapshot{
			Id:        1,
			Dashboard: jsonModel,
			Expires:   time.Now().Add(time.Duration(1000) * time.Second),
			UserId:    999999,
		}

		bus.AddHandler("test", func(query *m.GetDashboardSnapshotQuery) error {
			query.Result = mockSnapshotResult
			return nil
		})

		bus.AddHandler("test", func(cmd *m.DeleteDashboardSnapshotCommand) error {
			return nil
		})

		viewerRole := m.ROLE_VIEWER
		editorRole := m.ROLE_EDITOR
		aclMockResp := []*m.DashboardAclInfoDTO{}
		bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
			query.Result = aclMockResp
			return nil
		})

		teamResp := []*m.TeamDTO{}
		bus.AddHandler("test", func(query *m.GetTeamsByUserQuery) error {
			query.Result = teamResp
			return nil
		})

		Convey("When user has editor role and is not in the ACL", func() {
			Convey("Should not be able to delete snapshot", func() {
				loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/snapshots/12345", "/api/snapshots/:key", m.ROLE_EDITOR, func(sc *scenarioContext) {
					sc.handlerFunc = DeleteDashboardSnapshot
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

					So(sc.resp.Code, ShouldEqual, 403)
				})
			})
		})

		Convey("When user is anonymous", func() {
			Convey("Should be able to delete snapshot by deleteKey", func() {
				anonymousUserScenario("When calling GET on", "GET", "/api/snapshots-delete/12345", "/api/snapshots-delete/:deleteKey", func(sc *scenarioContext) {
					sc.handlerFunc = DeleteDashboardSnapshotByDeleteKey
					sc.fakeReqWithParams("GET", sc.url, map[string]string{"deleteKey": "12345"}).exec()

					So(sc.resp.Code, ShouldEqual, 200)
					respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
					So(err, ShouldBeNil)

					So(respJSON.Get("message").MustString(), ShouldStartWith, "Snapshot deleted")
				})
			})
		})

		Convey("When user is editor and dashboard has default ACL", func() {
			aclMockResp = []*m.DashboardAclInfoDTO{
				{Role: &viewerRole, Permission: m.PERMISSION_VIEW},
				{Role: &editorRole, Permission: m.PERMISSION_EDIT},
			}

			Convey("Should be able to delete a snapshot", func() {
				loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/snapshots/12345", "/api/snapshots/:key", m.ROLE_EDITOR, func(sc *scenarioContext) {
					sc.handlerFunc = DeleteDashboardSnapshot
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

					So(sc.resp.Code, ShouldEqual, 200)
					respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
					So(err, ShouldBeNil)

					So(respJSON.Get("message").MustString(), ShouldStartWith, "Snapshot deleted")
				})
			})
		})

		Convey("When user is editor and is the creator of the snapshot", func() {
			aclMockResp = []*m.DashboardAclInfoDTO{}
			mockSnapshotResult.UserId = TestUserID

			Convey("Should be able to delete a snapshot", func() {
				loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/snapshots/12345", "/api/snapshots/:key", m.ROLE_EDITOR, func(sc *scenarioContext) {
					sc.handlerFunc = DeleteDashboardSnapshot
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{"key": "12345"}).exec()

					So(sc.resp.Code, ShouldEqual, 200)
					respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
					So(err, ShouldBeNil)

					So(respJSON.Get("message").MustString(), ShouldStartWith, "Snapshot deleted")
				})
			})
		})
	})
}

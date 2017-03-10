package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	. "github.com/smartystreets/goconvey/convey"
)

func TestUserApiEndpoint(t *testing.T) {
	Convey("Given a user is logged in", t, func() {
		mockResult := models.SearchUserQueryResult{
			Users: []*models.UserSearchHitDTO{
				{Name: "user1"},
				{Name: "user2"},
			},
			TotalCount: 2,
		}

		loggedInUserScenario("When calling GET on", "/api/users", func(sc *scenarioContext) {
			var sentLimit int
			var sendPage int
			bus.AddHandler("test", func(query *models.SearchUsersQuery) error {
				query.Result = mockResult

				sentLimit = query.Limit
				sendPage = query.Page

				return nil
			})

			sc.handlerFunc = SearchUsers
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			So(sentLimit, ShouldEqual, 1000)
			So(sendPage, ShouldEqual, 1)

			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			So(err, ShouldBeNil)
			So(len(respJSON.MustArray()), ShouldEqual, 2)
		})

		loggedInUserScenario("When calling GET with page and limit querystring parameters on", "/api/users", func(sc *scenarioContext) {
			var sentLimit int
			var sendPage int
			bus.AddHandler("test", func(query *models.SearchUsersQuery) error {
				query.Result = mockResult

				sentLimit = query.Limit
				sendPage = query.Page

				return nil
			})

			sc.handlerFunc = SearchUsers
			sc.fakeReqWithParams("GET", sc.url, map[string]string{"perpage": "10", "page": "2"}).exec()

			So(sentLimit, ShouldEqual, 10)
			So(sendPage, ShouldEqual, 2)
		})

		loggedInUserScenario("When calling GET on", "/api/users/search", func(sc *scenarioContext) {
			var sentLimit int
			var sendPage int
			bus.AddHandler("test", func(query *models.SearchUsersQuery) error {
				query.Result = mockResult

				sentLimit = query.Limit
				sendPage = query.Page

				return nil
			})

			sc.handlerFunc = SearchUsersWithPaging
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			So(sentLimit, ShouldEqual, 1000)
			So(sendPage, ShouldEqual, 1)

			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			So(err, ShouldBeNil)

			So(respJSON.Get("totalCount").MustInt(), ShouldEqual, 2)
			So(len(respJSON.Get("users").MustArray()), ShouldEqual, 2)
		})

		loggedInUserScenario("When calling GET with page and perpage querystring parameters on", "/api/users/search", func(sc *scenarioContext) {
			var sentLimit int
			var sendPage int
			bus.AddHandler("test", func(query *models.SearchUsersQuery) error {
				query.Result = mockResult

				sentLimit = query.Limit
				sendPage = query.Page

				return nil
			})

			sc.handlerFunc = SearchUsersWithPaging
			sc.fakeReqWithParams("GET", sc.url, map[string]string{"perpage": "10", "page": "2"}).exec()

			So(sentLimit, ShouldEqual, 10)
			So(sendPage, ShouldEqual, 2)
		})
	})
}

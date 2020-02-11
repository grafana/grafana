package api

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
	"github.com/stretchr/testify/require"
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

		loggedInUserScenario("When calling GET on", "api/users/:id", func(sc *scenarioContext) {
			fakeNow := time.Date(2019, 2, 11, 17, 30, 40, 0, time.UTC)
			bus.AddHandler("test", func(query *models.GetUserProfileQuery) error {
				query.Result = models.UserProfileDTO{
					Id:             int64(1),
					Email:          "daniel@grafana.com",
					Name:           "Daniel",
					Login:          "danlee",
					OrgId:          int64(2),
					IsGrafanaAdmin: true,
					IsDisabled:     false,
					IsExternal:     false,
					UpdatedAt:      fakeNow,
					CreatedAt:      fakeNow,
				}
				return nil
			})

			bus.AddHandler("test", func(query *models.GetAuthInfoQuery) error {
				query.Result = &models.UserAuth{
					AuthModule: models.AuthModuleLDAP,
				}
				return nil
			})

			sc.handlerFunc = GetUserByID
			avatarUrl := dtos.GetGravatarUrl("daniel@grafana.com")
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			expected := fmt.Sprintf(`
			{
				"id": 1,
				"email": "daniel@grafana.com",
				"name": "Daniel",
				"login": "danlee",
				"theme": "",
				"orgId": 2,
				"isGrafanaAdmin": true,
				"isDisabled": false,
				"isExternal": true,
				"authLabels": [
					"LDAP"
				],
				"avatarUrl": "%s",
				"updatedAt": "2019-02-11T17:30:40Z",
				"createdAt": "2019-02-11T17:30:40Z"
			}
			`, avatarUrl)

			require.Equal(t, http.StatusOK, sc.resp.Code)
			require.JSONEq(t, expected, sc.resp.Body.String())
		})

		loggedInUserScenario("When calling GET on", "/api/users/lookup", func(sc *scenarioContext) {
			fakeNow := time.Date(2019, 2, 11, 17, 30, 40, 0, time.UTC)
			bus.AddHandler("test", func(query *models.GetUserByLoginQuery) error {
				require.Equal(t, "danlee", query.LoginOrEmail)

				query.Result = &models.User{
					Id:         int64(1),
					Email:      "daniel@grafana.com",
					Name:       "Daniel",
					Login:      "danlee",
					Theme:      "light",
					IsAdmin:    true,
					OrgId:      int64(2),
					IsDisabled: false,
					Updated:    fakeNow,
					Created:    fakeNow,
				}

				return nil
			})

			sc.handlerFunc = GetUserByLoginOrEmail
			sc.fakeReqWithParams("GET", sc.url, map[string]string{"loginOrEmail": "danlee"}).exec()

			expected := `
			{
				"id": 1,
				"email": "daniel@grafana.com",
				"name": "Daniel",
				"login": "danlee",
				"theme": "light",
				"orgId": 2,
				"isGrafanaAdmin": true,
				"isDisabled": false,
				"authLabels": null,
				"isExternal": false,
				"avatarUrl": "",
				"updatedAt": "2019-02-11T17:30:40Z",
				"createdAt": "2019-02-11T17:30:40Z"
			}
			`

			require.Equal(t, http.StatusOK, sc.resp.Code)
			require.JSONEq(t, expected, sc.resp.Body.String())
		})

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

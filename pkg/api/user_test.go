package api

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/searchusers/filters"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/services/searchusers"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserAPIEndpoint_userLoggedIn(t *testing.T) {
	settings := setting.NewCfg()
	hs := &HTTPServer{Cfg: settings}

	sqlStore := sqlstore.InitTestDB(t)
	hs.SQLStore = sqlStore

	mockResult := models.SearchUserQueryResult{
		Users: []*models.UserSearchHitDTO{
			{Name: "user1"},
			{Name: "user2"},
		},
		TotalCount: 2,
	}

	loggedInUserScenario(t, "When calling GET on", "api/users/1", "api/users/:id", func(sc *scenarioContext) {
		fakeNow := time.Date(2019, 2, 11, 17, 30, 40, 0, time.UTC)
		bus.AddHandler("test", func(ctx context.Context, query *models.GetUserProfileQuery) error {
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

		bus.AddHandler("test", func(ctx context.Context, query *models.GetAuthInfoQuery) error {
			query.Result = &models.UserAuth{
				AuthModule: models.AuthModuleLDAP,
			}
			return nil
		})

		sc.handlerFunc = hs.GetUserByID
		avatarUrl := dtos.GetGravatarUrl("daniel@grafana.com")
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"id": "1"}).exec()

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

	loggedInUserScenario(t, "When calling GET on", "/api/users/lookup", "/api/users/lookup", func(sc *scenarioContext) {
		fakeNow := time.Date(2019, 2, 11, 17, 30, 40, 0, time.UTC)
		bus.AddHandler("test", func(ctx context.Context, query *models.GetUserByLoginQuery) error {
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

	loggedInUserScenario(t, "When calling GET on", "/api/users", "/api/users", func(sc *scenarioContext) {
		var sentLimit int
		var sendPage int
		bus.AddHandler("test", func(ctx context.Context, query *models.SearchUsersQuery) error {
			query.Result = mockResult

			sentLimit = query.Limit
			sendPage = query.Page

			return nil
		})

		searchUsersService := searchusers.ProvideUsersService(bus.GetBus(), filters.ProvideOSSSearchUserFilter())
		sc.handlerFunc = searchUsersService.SearchUsers
		sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

		assert.Equal(t, 1000, sentLimit)
		assert.Equal(t, 1, sendPage)

		respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
		require.NoError(t, err)
		assert.Equal(t, 2, len(respJSON.MustArray()))
	})

	loggedInUserScenario(t, "When calling GET with page and limit querystring parameters on", "/api/users", "/api/users", func(sc *scenarioContext) {
		var sentLimit int
		var sendPage int
		bus.AddHandler("test", func(ctx context.Context, query *models.SearchUsersQuery) error {
			query.Result = mockResult

			sentLimit = query.Limit
			sendPage = query.Page

			return nil
		})

		searchUsersService := searchusers.ProvideUsersService(bus.GetBus(), filters.ProvideOSSSearchUserFilter())
		sc.handlerFunc = searchUsersService.SearchUsers
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"perpage": "10", "page": "2"}).exec()

		assert.Equal(t, 10, sentLimit)
		assert.Equal(t, 2, sendPage)
	})

	loggedInUserScenario(t, "When calling GET on", "/api/users/search", "/api/users/search", func(sc *scenarioContext) {
		var sentLimit int
		var sendPage int
		bus.AddHandler("test", func(ctx context.Context, query *models.SearchUsersQuery) error {
			query.Result = mockResult

			sentLimit = query.Limit
			sendPage = query.Page

			return nil
		})

		searchUsersService := searchusers.ProvideUsersService(bus.GetBus(), filters.ProvideOSSSearchUserFilter())
		sc.handlerFunc = searchUsersService.SearchUsersWithPaging
		sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

		assert.Equal(t, 1000, sentLimit)
		assert.Equal(t, 1, sendPage)

		respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
		require.NoError(t, err)

		assert.Equal(t, 2, respJSON.Get("totalCount").MustInt())
		assert.Equal(t, 2, len(respJSON.Get("users").MustArray()))
	})

	loggedInUserScenario(t, "When calling GET with page and perpage querystring parameters on", "/api/users/search", "/api/users/search", func(sc *scenarioContext) {
		var sentLimit int
		var sendPage int
		bus.AddHandler("test", func(ctx context.Context, query *models.SearchUsersQuery) error {
			query.Result = mockResult

			sentLimit = query.Limit
			sendPage = query.Page

			return nil
		})

		searchUsersService := searchusers.ProvideUsersService(bus.GetBus(), filters.ProvideOSSSearchUserFilter())
		sc.handlerFunc = searchUsersService.SearchUsersWithPaging
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"perpage": "10", "page": "2"}).exec()

		assert.Equal(t, 10, sentLimit)
		assert.Equal(t, 2, sendPage)
	})
}

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/login/authinfoservice"
	"github.com/grafana/grafana/pkg/services/searchusers/filters"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/services/searchusers"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserAPIEndpoint_userLoggedIn(t *testing.T) {
	settings := setting.NewCfg()
	sqlStore := sqlstore.InitTestDB(t)
	hs := &HTTPServer{
		Cfg:      settings,
		SQLStore: sqlStore,
	}

	mockResult := models.SearchUserQueryResult{
		Users: []*models.UserSearchHitDTO{
			{Name: "user1"},
			{Name: "user2"},
		},
		TotalCount: 2,
	}

	loggedInUserScenario(t, "When calling GET on", "api/users/1", "api/users/:id", func(sc *scenarioContext) {
		fakeNow := time.Date(2019, 2, 11, 17, 30, 40, 0, time.UTC)
		secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
		srv := authinfoservice.ProvideAuthInfoService(bus.New(), sqlStore, &authinfoservice.OSSUserProtectionImpl{}, secretsService)
		hs.authInfoService = srv

		createUserCmd := models.CreateUserCommand{
			Email:   fmt.Sprint("user", "@test.com"),
			Name:    "user",
			Login:   "loginuser",
			IsAdmin: true,
		}
		user, err := sqlStore.CreateUser(context.Background(), createUserCmd)
		require.Nil(t, err)

		sc.handlerFunc = hs.GetUserByID

		token := &oauth2.Token{
			AccessToken:  "testaccess",
			RefreshToken: "testrefresh",
			Expiry:       time.Now(),
			TokenType:    "Bearer",
		}
		idToken := "testidtoken"
		token = token.WithExtra(map[string]interface{}{"id_token": idToken})
		query := &models.GetUserByAuthInfoQuery{Login: "loginuser", AuthModule: "test", AuthId: "test"}
		cmd := &models.UpdateAuthInfoCommand{
			UserId:     user.Id,
			AuthId:     query.AuthId,
			AuthModule: query.AuthModule,
			OAuthToken: token,
		}
		err = srv.UpdateAuthInfo(context.Background(), cmd)
		require.NoError(t, err)
		avatarUrl := dtos.GetGravatarUrl("@test.com")
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"id": fmt.Sprintf("%v", user.Id)}).exec()

		expected := models.UserProfileDTO{
			Id:             1,
			Email:          "user@test.com",
			Name:           "user",
			Login:          "loginuser",
			OrgId:          1,
			IsGrafanaAdmin: true,
			AuthLabels:     []string{},
			CreatedAt:      fakeNow,
			UpdatedAt:      fakeNow,
			AvatarUrl:      avatarUrl,
		}

		var resp models.UserProfileDTO
		require.Equal(t, http.StatusOK, sc.resp.Code)
		err = json.Unmarshal(sc.resp.Body.Bytes(), &resp)
		require.NoError(t, err)
		resp.CreatedAt = fakeNow
		resp.UpdatedAt = fakeNow
		resp.AvatarUrl = avatarUrl
		require.EqualValues(t, expected, resp)
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
		createUserCmd := models.CreateUserCommand{
			Email:   fmt.Sprint("admin", "@test.com"),
			Name:    "admin",
			Login:   "admin",
			IsAdmin: true,
		}
		_, err := sqlStore.CreateUser(context.Background(), createUserCmd)
		require.Nil(t, err)

		sc.handlerFunc = hs.GetUserByLoginOrEmail
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"loginOrEmail": "admin@test.com"}).exec()

		var resp models.UserProfileDTO
		require.Equal(t, http.StatusOK, sc.resp.Code)
		err = json.Unmarshal(sc.resp.Body.Bytes(), &resp)
		require.NoError(t, err)
		require.Equal(t, "admin", resp.Login)
		require.Equal(t, "admin@test.com", resp.Email)
		require.True(t, resp.IsGrafanaAdmin)
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

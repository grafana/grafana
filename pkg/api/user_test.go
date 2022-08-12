package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/login/authinfoservice"
	authinfostore "github.com/grafana/grafana/pkg/services/login/authinfoservice/database"
	"github.com/grafana/grafana/pkg/services/searchusers"
	"github.com/grafana/grafana/pkg/services/searchusers/filters"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestUserAPIEndpoint_userLoggedIn(t *testing.T) {
	settings := setting.NewCfg()
	sqlStore := sqlstore.InitTestDB(t)
	hs := &HTTPServer{
		Cfg:           settings,
		SQLStore:      sqlStore,
		AccessControl: acmock.New(),
	}

	mockResult := models.SearchUserQueryResult{
		Users: []*models.UserSearchHitDTO{
			{Name: "user1"},
			{Name: "user2"},
		},
		TotalCount: 2,
	}
	mock := mockstore.NewSQLStoreMock()
	loggedInUserScenario(t, "When calling GET on", "api/users/1", "api/users/:id", func(sc *scenarioContext) {
		fakeNow := time.Date(2019, 2, 11, 17, 30, 40, 0, time.UTC)
		secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
		authInfoStore := authinfostore.ProvideAuthInfoStore(sqlStore, secretsService, usertest.NewUserServiceFake())
		srv := authinfoservice.ProvideAuthInfoService(
			&authinfoservice.OSSUserProtectionImpl{},
			authInfoStore,
			&usagestats.UsageStatsMock{},
		)
		hs.authInfoService = srv

		createUserCmd := user.CreateUserCommand{
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
		login := "loginuser"
		query := &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test", UserLookupParams: models.UserLookupParams{Login: &login}}
		cmd := &models.UpdateAuthInfoCommand{
			UserId:     user.ID,
			AuthId:     query.AuthId,
			AuthModule: query.AuthModule,
			OAuthToken: token,
		}
		err = srv.UpdateAuthInfo(context.Background(), cmd)
		require.NoError(t, err)
		avatarUrl := dtos.GetGravatarUrl("@test.com")
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"id": fmt.Sprintf("%v", user.ID)}).exec()

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
	}, mock)

	loggedInUserScenario(t, "When calling GET on", "/api/users/lookup", "/api/users/lookup", func(sc *scenarioContext) {
		createUserCmd := user.CreateUserCommand{
			Email:   fmt.Sprint("admin", "@test.com"),
			Name:    "admin",
			Login:   "admin",
			IsAdmin: true,
		}
		_, err := sqlStore.CreateUser(context.Background(), createUserCmd)
		require.Nil(t, err)

		sc.handlerFunc = hs.GetUserByLoginOrEmail

		userMock := usertest.NewUserServiceFake()
		userMock.ExpectedUser = &user.User{ID: 2}
		sc.userService = userMock
		hs.userService = userMock
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"loginOrEmail": "admin@test.com"}).exec()

		var resp models.UserProfileDTO
		require.Equal(t, http.StatusOK, sc.resp.Code)
		err = json.Unmarshal(sc.resp.Body.Bytes(), &resp)
		require.NoError(t, err)
	}, mock)

	loggedInUserScenario(t, "When calling GET on", "/api/users", "/api/users", func(sc *scenarioContext) {
		mock.ExpectedSearchUsers = mockResult

		searchUsersService := searchusers.ProvideUsersService(mock, filters.ProvideOSSSearchUserFilter())
		sc.handlerFunc = searchUsersService.SearchUsers
		sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

		respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
		require.NoError(t, err)

		assert.Equal(t, 2, len(respJSON.MustArray()))
	}, mock)

	loggedInUserScenario(t, "When calling GET with page and limit querystring parameters on", "/api/users", "/api/users", func(sc *scenarioContext) {
		mock.ExpectedSearchUsers = mockResult

		searchUsersService := searchusers.ProvideUsersService(mock, filters.ProvideOSSSearchUserFilter())
		sc.handlerFunc = searchUsersService.SearchUsers
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"perpage": "10", "page": "2"}).exec()

		respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
		require.NoError(t, err)

		assert.Equal(t, 2, len(respJSON.MustArray()))
	}, mock)

	loggedInUserScenario(t, "When calling GET on", "/api/users/search", "/api/users/search", func(sc *scenarioContext) {
		mock.ExpectedSearchUsers = mockResult

		searchUsersService := searchusers.ProvideUsersService(mock, filters.ProvideOSSSearchUserFilter())
		sc.handlerFunc = searchUsersService.SearchUsersWithPaging
		sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

		respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
		require.NoError(t, err)

		assert.Equal(t, 1, respJSON.Get("page").MustInt())
		assert.Equal(t, 1000, respJSON.Get("perPage").MustInt())
		assert.Equal(t, 2, respJSON.Get("totalCount").MustInt())
		assert.Equal(t, 2, len(respJSON.Get("users").MustArray()))
	}, mock)

	loggedInUserScenario(t, "When calling GET with page and perpage querystring parameters on", "/api/users/search", "/api/users/search", func(sc *scenarioContext) {
		mock.ExpectedSearchUsers = mockResult

		searchUsersService := searchusers.ProvideUsersService(mock, filters.ProvideOSSSearchUserFilter())
		sc.handlerFunc = searchUsersService.SearchUsersWithPaging
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"perpage": "10", "page": "2"}).exec()

		respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
		require.NoError(t, err)

		assert.Equal(t, 2, respJSON.Get("page").MustInt())
		assert.Equal(t, 10, respJSON.Get("perPage").MustInt())
	}, mock)
}

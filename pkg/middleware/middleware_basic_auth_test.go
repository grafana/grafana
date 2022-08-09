package middleware

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/login/logintest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMiddlewareBasicAuth(t *testing.T) {
	const id int64 = 12

	configure := func(cfg *setting.Cfg) {
		cfg.BasicAuthEnabled = true
		cfg.DisableBruteForceLoginProtection = true
	}

	middlewareScenario(t, "Valid API key", func(t *testing.T, sc *scenarioContext) {
		const orgID int64 = 2
		keyhash, err := util.EncodePassword("v5nAwpMafFP6znaS4urhdWDLS5511M42", "asd")
		require.NoError(t, err)

		sc.apiKeyService.ExpectedAPIKey = &apikey.APIKey{OrgId: orgID, Role: models.ROLE_EDITOR, Key: keyhash}

		authHeader := util.GetBasicAuthHeader("api_key", "eyJrIjoidjVuQXdwTWFmRlA2em5hUzR1cmhkV0RMUzU1MTFNNDIiLCJuIjoiYXNkIiwiaWQiOjF9")
		sc.fakeReq("GET", "/").withAuthorizationHeader(authHeader).exec()

		assert.Equal(t, 200, sc.resp.Code)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgId)
		assert.Equal(t, models.ROLE_EDITOR, sc.context.OrgRole)
	}, configure)

	middlewareScenario(t, "Handle auth", func(t *testing.T, sc *scenarioContext) {
		const password = "MyPass"
		const orgID int64 = 2

		sc.mockSQLStore.ExpectedSignedInUser = &models.SignedInUser{OrgId: orgID, UserId: id}

		authHeader := util.GetBasicAuthHeader("myUser", password)
		sc.fakeReq("GET", "/").withAuthorizationHeader(authHeader).exec()

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgId)
		assert.Equal(t, id, sc.context.UserId)
	}, configure)

	middlewareScenario(t, "Auth sequence", func(t *testing.T, sc *scenarioContext) {
		const password = "MyPass"
		const salt = "Salt"

		encoded, err := util.EncodePassword(password, salt)
		require.NoError(t, err)

		sc.mockSQLStore.ExpectedUser = &user.User{Password: encoded, ID: id, Salt: salt}
		sc.mockSQLStore.ExpectedSignedInUser = &models.SignedInUser{UserId: id}
		login.ProvideService(sc.mockSQLStore, &logintest.LoginServiceFake{}, usertest.NewUserServiceFake())

		authHeader := util.GetBasicAuthHeader("myUser", password)
		sc.fakeReq("GET", "/").withAuthorizationHeader(authHeader).exec()
		require.NotNil(t, sc.context)

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, id, sc.context.UserId)
	}, configure)

	middlewareScenario(t, "Should return error if user is not found", func(t *testing.T, sc *scenarioContext) {
		sc.mockSQLStore.ExpectedError = user.ErrUserNotFound
		sc.fakeReq("GET", "/")
		sc.req.SetBasicAuth("user", "password")
		sc.exec()

		err := json.NewDecoder(sc.resp.Body).Decode(&sc.respJson)
		require.Error(t, err)

		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, contexthandler.InvalidUsernamePassword, sc.respJson["message"])
	}, configure)

	middlewareScenario(t, "Should return error if user & password do not match", func(t *testing.T, sc *scenarioContext) {
		sc.mockSQLStore.ExpectedError = user.ErrUserNotFound
		sc.fakeReq("GET", "/")
		sc.req.SetBasicAuth("killa", "gorilla")
		sc.exec()

		err := json.NewDecoder(sc.resp.Body).Decode(&sc.respJson)
		require.Error(t, err)

		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, contexthandler.InvalidUsernamePassword, sc.respJson["message"])
	}, configure)
}

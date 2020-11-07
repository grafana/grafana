package middleware

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	authLogin "github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func basicAuthScenario(t *testing.T, desc string, fn scenarioFunc) {
	middlewareScenario(t, desc, func(t *testing.T, sc *scenarioContext) {
		sc.service.Cfg.BasicAuthEnabled = true
		sc.service.Cfg.DisableBruteForceLoginProtection = true

		bus.ClearBusHandlers()

		fn(t, sc)
	})
}

func TestMiddlewareBasicAuth(t *testing.T) {
	var id int64 = 12

	basicAuthScenario(t, "Valid API key", func(t *testing.T, sc *scenarioContext) {
		var orgID int64 = 2
		keyhash, err := util.EncodePassword("v5nAwpMafFP6znaS4urhdWDLS5511M42", "asd")
		require.NoError(t, err)

		bus.AddHandler("test", func(query *models.GetApiKeyByNameQuery) error {
			query.Result = &models.ApiKey{OrgId: orgID, Role: models.ROLE_EDITOR, Key: keyhash}
			return nil
		})

		authHeader := util.GetBasicAuthHeader("api_key", "eyJrIjoidjVuQXdwTWFmRlA2em5hUzR1cmhkV0RMUzU1MTFNNDIiLCJuIjoiYXNkIiwiaWQiOjF9")
		sc.fakeReq(t, "GET", "/").withAuthorizationHeader(authHeader).exec(t)

		require.Equal(t, 200, sc.resp.Code)

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgId)
		assert.Equal(t, models.ROLE_EDITOR, sc.context.OrgRole)
	})

	basicAuthScenario(t, "Handle auth", func(t *testing.T, sc *scenarioContext) {
		var password = "MyPass"
		var salt = "Salt"
		var orgID int64 = 2

		bus.AddHandler("grafana-auth", func(query *models.LoginUserQuery) error {
			encoded, err := util.EncodePassword(password, salt)
			if err != nil {
				return err
			}
			query.User = &models.User{
				Password: encoded,
				Salt:     salt,
			}
			return nil
		})

		bus.AddHandler("get-sign-user", func(query *models.GetSignedInUserQuery) error {
			query.Result = &models.SignedInUser{OrgId: orgID, UserId: id}
			return nil
		})

		authHeader := util.GetBasicAuthHeader("myUser", password)
		sc.fakeReq(t, "GET", "/").withAuthorizationHeader(authHeader).exec(t)

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgId)
		assert.Equal(t, id, sc.context.UserId)
	})

	basicAuthScenario(t, "Auth sequence", func(t *testing.T, sc *scenarioContext) {
		var password = "MyPass"
		var salt = "Salt"

		authLogin.Init()

		bus.AddHandler("user-query", func(query *models.GetUserByLoginQuery) error {
			encoded, err := util.EncodePassword(password, salt)
			if err != nil {
				return err
			}
			query.Result = &models.User{
				Password: encoded,
				Id:       id,
				Salt:     salt,
			}
			return nil
		})

		bus.AddHandler("get-sign-user", func(query *models.GetSignedInUserQuery) error {
			query.Result = &models.SignedInUser{UserId: query.UserId}
			return nil
		})

		authHeader := util.GetBasicAuthHeader("myUser", password)
		sc.fakeReq(t, "GET", "/").withAuthorizationHeader(authHeader).exec(t)

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, id, sc.context.UserId)
	})

	basicAuthScenario(t, "Should return error if user is not found", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq(t, "GET", "/")
		sc.req.SetBasicAuth("user", "password")
		sc.exec(t)

		err := json.NewDecoder(sc.resp.Body).Decode(&sc.respJson)
		require.NoError(t, err)

		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, errStringInvalidUsernamePassword, sc.respJson["message"])
	})

	basicAuthScenario(t, "Should return error if user & password do not match", func(t *testing.T, sc *scenarioContext) {
		bus.AddHandler("user-query", func(loginUserQuery *models.GetUserByLoginQuery) error {
			return nil
		})

		sc.fakeReq(t, "GET", "/")
		sc.req.SetBasicAuth("killa", "gorilla")
		sc.exec(t)

		err := json.NewDecoder(sc.resp.Body).Decode(&sc.respJson)
		require.NoError(t, err)

		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, errStringInvalidUsernamePassword, sc.respJson["message"])
	})
}

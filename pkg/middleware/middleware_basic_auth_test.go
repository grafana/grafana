package middleware

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler"
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

		bus.AddHandler("test", func(query *models.GetApiKeyByNameQuery) error {
			query.Result = &models.ApiKey{OrgId: orgID, Role: models.ROLE_EDITOR, Key: keyhash}
			return nil
		})

		authHeader := util.GetBasicAuthHeader("api_key", "eyJrIjoidjVuQXdwTWFmRlA2em5hUzR1cmhkV0RMUzU1MTFNNDIiLCJuIjoiYXNkIiwiaWQiOjF9")
		sc.fakeReq("GET", "/").withAuthorizationHeader(authHeader).exec()

		assert.Equal(t, 200, sc.resp.Code)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgId)
		assert.Equal(t, models.ROLE_EDITOR, sc.context.OrgRole)
	}, configure)

	middlewareScenario(t, "Handle auth", func(t *testing.T, sc *scenarioContext) {
		const password = "MyPass"
		const salt = "Salt"
		const orgID int64 = 2

		bus.AddHandler("grafana-auth", func(query *models.LoginUserQuery) error {
			t.Log("Handling LoginUserQuery")
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

		bus.AddHandlerCtx("get-sign-user", func(ctx context.Context, query *models.GetSignedInUserQuery) error {
			t.Log("Handling GetSignedInUserQuery")
			query.Result = &models.SignedInUser{OrgId: orgID, UserId: id}
			return nil
		})

		authHeader := util.GetBasicAuthHeader("myUser", password)
		sc.fakeReq("GET", "/").withAuthorizationHeader(authHeader).exec()

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgId)
		assert.Equal(t, id, sc.context.UserId)
	}, configure)

	middlewareScenario(t, "Auth sequence", func(t *testing.T, sc *scenarioContext) {
		const password = "MyPass"
		const salt = "Salt"

		login.Init()

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

		bus.AddHandlerCtx("get-sign-user", func(ctx context.Context, query *models.GetSignedInUserQuery) error {
			query.Result = &models.SignedInUser{UserId: query.UserId}
			return nil
		})

		authHeader := util.GetBasicAuthHeader("myUser", password)
		sc.fakeReq("GET", "/").withAuthorizationHeader(authHeader).exec()
		require.NotNil(t, sc.context)

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, id, sc.context.UserId)
	}, configure)

	middlewareScenario(t, "Should return error if user is not found", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/")
		sc.req.SetBasicAuth("user", "password")
		sc.exec()

		err := json.NewDecoder(sc.resp.Body).Decode(&sc.respJson)
		require.Error(t, err)

		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, contexthandler.InvalidUsernamePassword, sc.respJson["message"])
	}, configure)

	middlewareScenario(t, "Should return error if user & password do not match", func(t *testing.T, sc *scenarioContext) {
		bus.AddHandler("user-query", func(loginUserQuery *models.GetUserByLoginQuery) error {
			return nil
		})

		sc.fakeReq("GET", "/")
		sc.req.SetBasicAuth("killa", "gorilla")
		sc.exec()

		err := json.NewDecoder(sc.resp.Body).Decode(&sc.respJson)
		require.Error(t, err)

		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, contexthandler.InvalidUsernamePassword, sc.respJson["message"])
	}, configure)
}

package middleware

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/setting"
)

func TestMiddlewareJWTAuth(t *testing.T) {
	const id int64 = 12
	const orgID int64 = 2

	configure := func(cfg *setting.Cfg) {
		cfg.JWTAuthEnabled = true
		cfg.JWTAuthHeaderName = "x-jwt-assertion"
	}

	configureUsernameClaim := func(cfg *setting.Cfg) {
		cfg.JWTAuthUsernameClaim = "foo-username"
	}

	configureEmailClaim := func(cfg *setting.Cfg) {
		cfg.JWTAuthEmailClaim = "foo-email"
	}

	configureAutoSignUp := func(cfg *setting.Cfg) {
		cfg.JWTAuthAutoSignUp = true
	}

	token := "some-token"

	middlewareScenario(t, "Valid token with valid login claim", func(t *testing.T, sc *scenarioContext) {
		myUsername := "vladimir"
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub":          myUsername,
				"foo-username": myUsername,
			}, nil
		}
		bus.AddHandler("get-sign-user", func(ctx context.Context, query *models.GetSignedInUserQuery) error {
			query.Result = &models.SignedInUser{
				UserId: id,
				OrgId:  orgID,
				Login:  query.Login,
			}
			return nil
		})

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 200, sc.resp.Code)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgId)
		assert.Equal(t, id, sc.context.UserId)
		assert.Equal(t, myUsername, sc.context.Login)
	}, configure, configureUsernameClaim)

	middlewareScenario(t, "Valid token with valid email claim", func(t *testing.T, sc *scenarioContext) {
		myEmail := "vladimir@example.com"
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub":       myEmail,
				"foo-email": myEmail,
			}, nil
		}
		bus.AddHandler("get-sign-user", func(ctx context.Context, query *models.GetSignedInUserQuery) error {
			query.Result = &models.SignedInUser{
				UserId: id,
				OrgId:  orgID,
				Email:  query.Email,
			}
			return nil
		})

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 200, sc.resp.Code)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgId)
		assert.Equal(t, id, sc.context.UserId)
		assert.Equal(t, myEmail, sc.context.Email)
	}, configure, configureEmailClaim)

	middlewareScenario(t, "Valid token with no user and auto_sign_up disabled", func(t *testing.T, sc *scenarioContext) {
		myEmail := "vladimir@example.com"
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub":       myEmail,
				"name":      "Vladimir Example",
				"foo-email": myEmail,
			}, nil
		}
		bus.AddHandler("get-sign-user", func(ctx context.Context, query *models.GetSignedInUserQuery) error {
			return models.ErrUserNotFound
		})

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, contexthandler.UserNotFound, sc.respJson["message"])
	}, configure, configureEmailClaim)

	middlewareScenario(t, "Valid token with no user and auto_sign_up enabled", func(t *testing.T, sc *scenarioContext) {
		myEmail := "vladimir@example.com"
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub":       myEmail,
				"name":      "Vladimir Example",
				"foo-email": myEmail,
			}, nil
		}
		bus.AddHandler("get-sign-user", func(ctx context.Context, query *models.GetSignedInUserQuery) error {
			query.Result = &models.SignedInUser{
				UserId: id,
				OrgId:  orgID,
				Email:  query.Email,
			}
			return nil
		})
		bus.AddHandler("upsert-user", func(ctx context.Context, command *models.UpsertUserCommand) error {
			command.Result = &models.User{
				Id:    id,
				Name:  command.ExternalUser.Name,
				Email: command.ExternalUser.Email,
			}
			return nil
		})

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 200, sc.resp.Code)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgId)
		assert.Equal(t, id, sc.context.UserId)
		assert.Equal(t, myEmail, sc.context.Email)
	}, configure, configureEmailClaim, configureAutoSignUp)

	middlewareScenario(t, "Valid token without a login claim", func(t *testing.T, sc *scenarioContext) {
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub": "baz",
				"foo": "bar",
			}, nil
		}

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, contexthandler.InvalidJWT, sc.respJson["message"])
	}, configure, configureUsernameClaim)

	middlewareScenario(t, "Valid token without a email claim", func(t *testing.T, sc *scenarioContext) {
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub": "baz",
				"foo": "bar",
			}, nil
		}

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, contexthandler.InvalidJWT, sc.respJson["message"])
	}, configure, configureEmailClaim)

	middlewareScenario(t, "Invalid token", func(t *testing.T, sc *scenarioContext) {
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return nil, errors.New("token is invalid")
		}

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, contexthandler.InvalidJWT, sc.respJson["message"])
	}, configure, configureUsernameClaim)
}

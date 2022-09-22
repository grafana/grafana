package middleware

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestMiddlewareJWTAuth(t *testing.T) {
	const myEmail = "vladimir@example.com"
	const id int64 = 12
	const orgID int64 = 2

	configure := func(cfg *setting.Cfg) {
		cfg.JWTAuthEnabled = true
		cfg.JWTAuthHeaderName = "x-jwt-assertion"
	}

	configureAuthHeader := func(cfg *setting.Cfg) {
		cfg.JWTAuthEnabled = true
		cfg.JWTAuthHeaderName = "Authorization"
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

	configureRole := func(cfg *setting.Cfg) {
		cfg.JWTAuthEmailClaim = "sub"
		cfg.JWTAuthRoleAttributePath = "role"
	}

	configureRoleStrict := func(cfg *setting.Cfg) {
		cfg.JWTAuthRoleAttributeStrict = true
	}

	configureRoleAllowAdmin := func(cfg *setting.Cfg) {
		cfg.JWTAuthAllowAssignGrafanaAdmin = true
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
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{UserID: id, OrgID: orgID, Login: myUsername}

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 200, sc.resp.Code)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgID)
		assert.Equal(t, id, sc.context.UserID)
		assert.Equal(t, myUsername, sc.context.Login)
	}, configure, configureUsernameClaim)

	middlewareScenario(t, "Valid token with bearer in authorization header", func(t *testing.T, sc *scenarioContext) {
		myUsername := "vladimir"
		// We can ignore gosec G101 since this does not contain any credentials.
		// nolint:gosec
		myToken := "some.jwt.token"
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = myToken
			return models.JWTClaims{
				"sub":          myUsername,
				"foo-username": myUsername,
			}, nil
		}
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{UserID: id, OrgID: orgID, Login: myUsername}

		sc.fakeReq("GET", "/").withJWTAuthHeader("Bearer " + myToken).exec()
		assert.Equal(t, verifiedToken, myToken)
		assert.Equal(t, 200, sc.resp.Code)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgID)
		assert.Equal(t, id, sc.context.UserID)
		assert.Equal(t, myUsername, sc.context.Login)
	}, configureAuthHeader, configureUsernameClaim)

	middlewareScenario(t, "Valid token with valid email claim", func(t *testing.T, sc *scenarioContext) {
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub":       myEmail,
				"foo-email": myEmail,
			}, nil
		}
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{UserID: id, OrgID: orgID, Email: myEmail}

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 200, sc.resp.Code)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgID)
		assert.Equal(t, id, sc.context.UserID)
		assert.Equal(t, myEmail, sc.context.Email)
	}, configure, configureEmailClaim)

	middlewareScenario(t, "Valid token with no user and auto_sign_up disabled", func(t *testing.T, sc *scenarioContext) {
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub":       myEmail,
				"name":      "Vladimir Example",
				"foo-email": myEmail,
			}, nil
		}
		sc.userService.ExpectedError = user.ErrUserNotFound

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, contexthandler.UserNotFound, sc.respJson["message"])
	}, configure, configureEmailClaim)

	middlewareScenario(t, "Valid token with no user and auto_sign_up enabled", func(t *testing.T, sc *scenarioContext) {
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub":       myEmail,
				"name":      "Vladimir Example",
				"foo-email": myEmail,
			}, nil
		}
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{UserID: id, OrgID: orgID, Email: myEmail}

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 200, sc.resp.Code)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgID)
		assert.Equal(t, id, sc.context.UserID)
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

	middlewareScenario(t, "Valid token with role", func(t *testing.T, sc *scenarioContext) {
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub":  myEmail,
				"role": "Editor",
			}, nil
		}
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{UserID: id, OrgID: orgID, Email: myEmail, OrgRole: org.RoleEditor}

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 200, sc.resp.Code)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, org.RoleEditor, sc.context.OrgRole)
	}, configure, configureAutoSignUp, configureRole)

	middlewareScenario(t, "Valid token with invalid role", func(t *testing.T, sc *scenarioContext) {
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub":  myEmail,
				"role": "test",
			}, nil
		}
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{UserID: id, OrgID: orgID, Email: myEmail, OrgRole: org.RoleViewer}

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 200, sc.resp.Code)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, org.RoleViewer, sc.context.OrgRole)
	}, configure, configureAutoSignUp, configureRole)

	middlewareScenario(t, "Valid token with invalid role in strict mode", func(t *testing.T, sc *scenarioContext) {
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub":  myEmail,
				"role": "test",
			}, nil
		}
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{UserID: id, OrgID: orgID, Email: myEmail, OrgRole: org.RoleViewer}

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 403, sc.resp.Code)
		assert.Equal(t, contexthandler.InvalidRole, sc.respJson["message"])
	}, configure, configureAutoSignUp, configureRole, configureRoleStrict)

	middlewareScenario(t, "Valid token with grafana admin role not allowed", func(t *testing.T, sc *scenarioContext) {
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub":  myEmail,
				"role": "GrafanaAdmin",
			}, nil
		}
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{UserID: id, OrgID: orgID, Email: myEmail, OrgRole: org.RoleAdmin}

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 200, sc.resp.Code)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, org.RoleAdmin, sc.context.OrgRole)
		assert.False(t, sc.context.IsGrafanaAdmin)
	}, configure, configureAutoSignUp, configureRole)

	middlewareScenario(t, "Valid token with grafana admin role allowed", func(t *testing.T, sc *scenarioContext) {
		var verifiedToken string
		sc.jwtAuthService.VerifyProvider = func(ctx context.Context, token string) (models.JWTClaims, error) {
			verifiedToken = token
			return models.JWTClaims{
				"sub":  myEmail,
				"role": "GrafanaAdmin",
			}, nil
		}
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{UserID: id, OrgID: orgID, Email: myEmail, OrgRole: org.RoleAdmin, IsGrafanaAdmin: true}

		sc.fakeReq("GET", "/").withJWTAuthHeader(token).exec()
		assert.Equal(t, verifiedToken, token)
		assert.Equal(t, 200, sc.resp.Code)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, org.RoleAdmin, sc.context.OrgRole)
		assert.True(t, sc.context.IsGrafanaAdmin)
	}, configure, configureAutoSignUp, configureRole, configureRoleAllowAdmin)

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

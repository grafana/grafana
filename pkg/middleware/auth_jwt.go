package middleware

import (
	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var logger log.Logger = log.New("middleware.jwt")

//
// Claims SQL Functions
//

func getSignedInUserQueryForClaims(claims map[string]interface{}, orgId int64) *m.GetSignedInUserQuery {
	query := m.GetSignedInUserQuery{}
	query.OrgId = orgId

	if setting.AuthJwtLoginClaim != "" {
		if val, ok := claims[setting.AuthJwtLoginClaim].(string); ok {
			query.Login = val
			return &query
		}
	}

	if setting.AuthJwtEmailClaim != "" {
		if val, ok := claims[setting.AuthJwtEmailClaim].(string); ok {
			query.Email = val
			return &query
		}
	}

	return nil
}

func getCreateUserCommandForClaims(claims map[string]interface{}) *m.CreateUserCommand {
	cmd := m.CreateUserCommand{}

	if setting.AuthJwtLoginClaim != "" {
		if val, ok := claims[setting.AuthJwtLoginClaim].(string); ok {
			cmd.Login = val
		}
	}

	if setting.AuthJwtEmailClaim != "" {
		if val, ok := claims[setting.AuthJwtEmailClaim].(string); ok {
			cmd.Email = val

			// Use email for the login if one is not configured
			if cmd.Login == "" {
				cmd.Login = val
			}
		}
	}

	return &cmd
}

// used by every request
var decoder *util.JWTDecoder

// Initialized once at startup
func InitAuthJwtKey() error {
	logger.Info("Initializing JWT Auth")

	decoder = util.NewJWTDecoder(setting.AuthJwtSigningKey)
	// TODO, add other settings

	if !decoder.CheckReady() {
		err := fmt.Errorf("JWT Keys did not initialize")
		fmt.Printf("ERROR InitAuthJwtKey: %v\n", err)
		return err
	}

	if setting.AuthJwtLoginClaim == "" && setting.AuthJwtEmailClaim == "" {
		err := fmt.Errorf("JWT Auth must have either a login or email claim configured")
		logger.Error("Error", err)
		return err
	}

	return nil
}

// Called in chain from middleware.GetContextHandler
func initContextWithJwtAuth(ctx *m.ReqContext, orgId int64) bool {
	if !setting.AuthJwtEnabled || decoder == nil {
		return false
	}

	// Check the header and cookie
	jwtText := ctx.Req.Header.Get(setting.AuthJwtHeader)
	if len(jwtText) == 0 {
		return false
	}

	// Parse and validate the token
	claims, err := decoder.Decode(jwtText)
	if err != nil {
		ctx.JsonApiErr(400, "JWT Error", err)
		return true
	}

	if setting.AuthJwtAudience != "" {
		val, ok := claims["aud"].(string)
		if !ok || val != setting.AuthJwtAudience {
			ctx.JsonApiErr(400, "Bad JWT Audience", err)
			return true
		}
	}

	if setting.AuthJwtIssuer != "" {
		val, ok := claims["iss"].(string)
		if !ok || val != setting.AuthJwtIssuer {
			ctx.JsonApiErr(400, "Bad JWT Issuer", err)
			return true
		}
	}

	query := getSignedInUserQueryForClaims(claims, orgId)
	if err := bus.Dispatch(query); err != nil {
		if err != m.ErrUserNotFound {
			ctx.JsonApiErr(500, "User query failed for JWT", err)
			return true
		}

		if setting.AuthJwtAutoSignup {
			cmd := getCreateUserCommandForClaims(claims)

			logger.Info("Create User from JWT", "claims", claims)

			if err := bus.Dispatch(cmd); err != nil {
				ctx.JsonApiErr(500, "Failed to create user specified in auth JWT", err)
				return true
			}

			query = &m.GetSignedInUserQuery{UserId: cmd.Result.Id, OrgId: orgId}
			if err := bus.Dispatch(query); err != nil {
				ctx.JsonApiErr(500, "Failed to find user after creation", err)
				return true
			}

		} else {
			// Valid JWT, but user not in the database
			ctx.JsonApiErr(403, "User Not Found", err)
			return true
		}
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	return true
}

package middleware

import (
	"github.com/dgrijalva/jwt-go"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

// var remoteKeySet *xjwt.RemoteKeyset

var keyFunc jwt.Keyfunc

func JwtAuthInit() {

	log.Info("Initializing JWT Auth!!! load the function?")

	// Simple static bytes
	keyFunc = func(token *jwt.Token) (interface{}, error) {
		return []byte("AllYourBase"), nil
	}

	// keyset, err := xjwt.NewRemoteKeyset(context.TODO(), xjwt.KeysetOptions{
	// 	UserAgent: fmt.Sprintf("grafana/%s", setting.BuildVersion),
	// 	URL:       setting.AuthJwtJwksUrl,
	// })
	// if err != nil {
	// 	panic(err)
	// }

	// remoteKeySet = keyset
}


func initContextWithJwtAuth(ctx *m.ReqContext, orgId int64) bool {
	if !setting.AuthJwtEnabled {
		return false
	}

	jwtHeaderValue := ctx.Req.Header.Get(setting.AuthJwtHeaderName)
	if len(jwtHeaderValue) == 0 {
		return false
	}

	// Parse and validate the token
	token, err := jwt.Parse(jwtHeaderValue, keyFunc)
	if !token.Valid {
		ctx.Handle(400, "JWT Error", err)
		return true
	}
	claims := token.Claims.(jwt.MapClaims);
	
	query := getSignedInUserQueryForClaims(claims, orgId)
	if err := bus.Dispatch(query); err != nil {
		if err != m.ErrUserNotFound {
			ctx.Handle(500, "User query failed for JWT", err)
			return true
		}

		if setting.AuthJwtAutoSignup {
			cmd := getCreateUserCommandForClaims(claims)

			if err := bus.Dispatch(cmd); err != nil {
				ctx.Handle(500, "Failed to create user specified in auth JWT", err)
				return true
			}

			query = &m.GetSignedInUserQuery{UserId: cmd.Result.Id, OrgId: orgId}
			if err := bus.Dispatch(query); err != nil {
				ctx.Handle(500, "Failed to find user after creation", err)
				return true
			}

		} else {
			// Valid JWT, but user not in the database
			ctx.Handle(403, "User Not Found", err)
			return true
		}
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	return true
}

func getSignedInUserQueryForClaims(claims jwt.Claims, orgId int64) *m.GetSignedInUserQuery {
	query := &m.GetSignedInUserQuery{}
	query.OrgId = orgId

	/**
	if setting.AuthJwtUserProperty == "username" {
		query.Login = jwtUser
	} else if setting.AuthJwtUserProperty == "email" {
		query.Email = jwtUser
	} else {
		panic("JWT Auth property invalid")
	}
	**/

	return query
}

func getCreateUserCommandForClaims(claims jwt.Claims) *m.CreateUserCommand {
	cmd := m.CreateUserCommand{}
	// if setting.AuthJwtUserProperty == "username" {
	// 	cmd.Login = jwtUser
	// 	cmd.Email = jwtUser
	// } else if setting.AuthJwtUserProperty == "email" {
	// 	cmd.Email = jwtUser
	// 	cmd.Login = jwtUser
	// }
	return &cmd
}

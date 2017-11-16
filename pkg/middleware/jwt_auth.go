package middleware

import (
	"context"
	"errors"
	"fmt"

	"github.com/ScaleFT/xjwt"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/login"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var remoteKeySet *xjwt.RemoteKeyset

func JwtAuthInit() {
	keyset, err := xjwt.NewRemoteKeyset(context.TODO(), xjwt.KeysetOptions{
		UserAgent: fmt.Sprintf("grafana/%s", setting.BuildVersion),
		URL:       setting.AuthJwtJwksUrl,
	})
	if err != nil {
		panic(err)
	}

	remoteKeySet = keyset
}

func initContextWithJwtAuth(ctx *Context, orgId int64) bool {
	if !setting.AuthJwtEnabled {
		return false
	}

	jwtHeaderValue := ctx.Req.Header.Get(setting.AuthJwtHeaderName)
	if len(jwtHeaderValue) == 0 {
		return false
	}

	jwtUser, err := verifyJwt(jwtHeaderValue)
	if err != nil {
		log.Error(3, "Unable to verify auth JWT", err)
		return false
	}

	query := getSignedInUserQueryForJwtAuth(jwtUser)
	query.OrgId = orgId
	if err := bus.Dispatch(query); err != nil {
		if err != m.ErrUserNotFound {
			ctx.Handle(500, "Failed to find user specified in the auth JWT", err)
			return true
		}

		if setting.AuthJwtAutoSignup {
			cmd := getCreateUserCommandForJwtAuth(jwtUser)
			if setting.LdapEnabled {
				cmd.SkipOrgSetup = true
			}

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
			return false
		}
	}

	if err := ctx.Session.Start(ctx); err != nil {
		log.Error(3, "Failed to start session", err)
		return false
	}

	requestUserId := getRequestUserId(ctx)
	if requestUserId > 0 && requestUserId != query.Result.UserId {
		if err := ctx.Session.Destory(ctx); err != nil {
			log.Error(3, "Failed to destroy session", err)
		}

		if err := ctx.Session.Start(ctx); err != nil {
			log.Error(3, "Failed to start session", err)
		}
	}

	if err := syncGrafanaUserWithLdapUser(ctx, query); err != nil {
		if err == login.ErrInvalidCredentials {
			ctx.Handle(500, "Unable to authenticate user", err)
			return false
		}

		ctx.Handle(500, "Failed to sync user", err)
		return false
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	ctx.Session.Set(SESS_KEY_USERID, ctx.UserId)

	return true
}

func verifyJwt(jwt string) (string, error) {
	keyset, err := remoteKeySet.Get()
	if err != nil {
		return "", err
	}

	payload, err := xjwt.Verify([]byte(jwt), xjwt.VerifyConfig{
		ExpectedAudience: setting.AuthJwtAudience,
		ExpectedIssuer:   setting.AuthJwtIssuer,
		KeySet:           keyset,
	})
	if err != nil {
		return "", err
	}

	if userField, ok := payload[setting.AuthJwtUserField]; ok {
		if user, ok := userField.(string); ok {
			return user, nil
		} else {
			return "", errors.New(fmt.Sprintf("Unable to convert user value to string."))
		}
	} else {
		return "", errors.New(fmt.Sprintf("JWT does not have expected user field(%s).", setting.AuthJwtUserField))
	}
}

func getSignedInUserQueryForJwtAuth(jwtUser string) *m.GetSignedInUserQuery {
	query := &m.GetSignedInUserQuery{}

	if setting.AuthJwtUserProperty == "username" {
		query.Login = jwtUser
	} else if setting.AuthJwtUserProperty == "email" {
		query.Email = jwtUser
	} else {
		panic("JWT Auth property invalid")
	}

	return query
}

func getCreateUserCommandForJwtAuth(jwtUser string) *m.CreateUserCommand {
	cmd := m.CreateUserCommand{}
	if setting.AuthJwtUserProperty == "username" {
		cmd.Login = jwtUser
		cmd.Email = jwtUser
	} else if setting.AuthJwtUserProperty == "email" {
		cmd.Email = jwtUser
		cmd.Login = jwtUser
	} else {
		panic("JWT Auth property invalid")
	}
	return &cmd
}

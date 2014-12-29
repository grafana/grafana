package api

import (
	"errors"
	"fmt"

	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/setting"
	"github.com/torkelo/grafana-pro/pkg/social"
)

func OAuthLogin(ctx *middleware.Context) {
	if setting.OAuthService == nil {
		ctx.Handle(404, "login.OAuthLogin(oauth service not enabled)", nil)
		return
	}

	name := ctx.Params(":name")
	connect, ok := social.SocialMap[name]
	if !ok {
		ctx.Handle(404, "login.OAuthLogin(social login not enabled)", errors.New(name))
		return
	}

	code := ctx.Query("code")
	if code == "" {
		ctx.Redirect(connect.AuthCodeURL("", "online", "auto"))
		return
	}
	log.Info("code: %v", code)

	// handle call back
	transport, err := connect.NewTransportFromCode(code)
	if err != nil {
		ctx.Handle(500, "login.OAuthLogin(NewTransportWithCode)", err)
		return
	}

	log.Trace("login.OAuthLogin(Got token)")

	userInfo, err := connect.UserInfo(transport)
	if err != nil {
		ctx.Handle(500, fmt.Sprintf("login.OAuthLogin(get info from %s)", name), err)
		return
	}

	log.Info("login.OAuthLogin(social login): %s", userInfo)

	userQuery := m.GetAccountByLoginQuery{Login: userInfo.Email}
	err = bus.Dispatch(&userQuery)

	// create account if missing
	if err == m.ErrAccountNotFound {
		cmd := &m.CreateAccountCommand{
			Login:   userInfo.Email,
			Email:   userInfo.Email,
			Name:    userInfo.Name,
			Company: userInfo.Company,
		}

		if err = bus.Dispatch(&cmd); err != nil {
			ctx.Handle(500, "Failed to create account", err)
			return
		}

		userQuery.Result = &cmd.Result
	} else if err != nil {
		ctx.Handle(500, "Unexpected error", err)
	}

	// login
	loginUserWithAccount(userQuery.Result, ctx)

	ctx.Redirect("/")
}

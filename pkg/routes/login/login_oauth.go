package login

import (
	"errors"
	"fmt"

	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	"github.com/torkelo/grafana-pro/pkg/models"
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

	account, err := models.GetAccountByLogin(userInfo.Email)

	// create account if missing
	if err == models.ErrAccountNotFound {
		account = &models.Account{
			Login:   userInfo.Email,
			Email:   userInfo.Email,
			Name:    userInfo.Name,
			Company: userInfo.Company,
		}

		if err = models.CreateAccount(account); err != nil {
			ctx.Handle(500, "Failed to create account", err)
			return
		}
	} else if err != nil {
		ctx.Handle(500, "Unexpected error", err)
	}

	// login
	loginUserWithAccount(account, ctx)

	ctx.Redirect("/")
}

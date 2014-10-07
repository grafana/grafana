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
		ctx.Handle(404, "social.SocialSignIn(oauth service not enabled)", nil)
		return
	}

	name := ctx.Params(":name")
	connect, ok := social.SocialMap[name]
	if !ok {
		ctx.Handle(404, "social.SocialSignIn(social login not enabled)", errors.New(name))
		return
	}

	code := ctx.Query("code")
	if code == "" {
		ctx.Redirect(connect.AuthCodeURL("", "online", "auto"))
		return
	}

	// handle call back
	transport, err := connect.NewTransportWithCode(code)
	if err != nil {
		ctx.Handle(500, "social.SocialSignIn(NewTransportWithCode)", err)
		return
	}

	log.Trace("social.SocialSignIn(Got token)")

	userInfo, err := connect.UserInfo(transport)
	if err != nil {
		ctx.Handle(500, fmt.Sprintf("social.SocialSignIn(get info from %s)", name), err)
		return
	}

	log.Info("social.SocialSignIn(social login): %s", userInfo)

	account, err := models.GetAccountByLogin(userInfo.Email)

	// create account if missing
	if err == models.ErrAccountNotFound {
		account = &models.Account{
			Login:   userInfo.Login,
			Email:   userInfo.Email,
			Name:    userInfo.Name,
			Company: userInfo.Company,
		}

		if err = models.CreateAccount(account); err != nil {
			ctx.Handle(500, "Failed to create account", err)
			return
		}
	}

	// login
	loginUserWithAccount(account, ctx)

	ctx.Redirect("/")
}

package api

import (
	"errors"
	"fmt"
	"net/url"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/social"
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
		ctx.Redirect(connect.AuthCodeURL("", oauth2.AccessTypeOnline))
		return
	}

	// handle call back
	token, err := connect.Exchange(oauth2.NoContext, code)
	if err != nil {
		ctx.Handle(500, "login.OAuthLogin(NewTransportWithCode)", err)
		return
	}

	log.Trace("login.OAuthLogin(Got token)")

	userInfo, err := connect.UserInfo(token)
	if err != nil {
		if err == social.ErrMissingTeamMembership {
			ctx.Redirect(setting.AppSubUrl + "/login?failedMsg=" + url.QueryEscape("Required Github team membership not fulfilled"))
		} else if err == social.ErrMissingOrganizationMembership {
			ctx.Redirect(setting.AppSubUrl + "/login?failedMsg=" + url.QueryEscape("Required Github organization membership not fulfilled"))
		} else {
			ctx.Handle(500, fmt.Sprintf("login.OAuthLogin(get info from %s)", name), err)
		}
		return
	}

	log.Trace("login.OAuthLogin(social login): %s", userInfo)

	// validate that the email is allowed to login to grafana
	if !connect.IsEmailAllowed(userInfo.Email) {
		log.Info("OAuth login attempt with unallowed email, %s", userInfo.Email)
		ctx.Redirect(setting.AppSubUrl + "/login?failedMsg=" + url.QueryEscape("Required email domain not fulfilled"))
		return
	}

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: userInfo.Email}
	err = bus.Dispatch(&userQuery)

	// create account if missing
	if err == m.ErrUserNotFound {
		if !connect.IsSignupAllowed() {
			ctx.Redirect(setting.AppSubUrl + "/login")
			return
		}

		cmd := m.CreateUserCommand{
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
	loginUserWithUser(userQuery.Result, ctx)

	metrics.M_Api_Login_OAuth.Inc(1)

	ctx.Redirect(setting.AppSubUrl + "/")
}

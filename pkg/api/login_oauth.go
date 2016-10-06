package api

import (
	"errors"
	"fmt"
	"crypto/rand"
	"encoding/base64"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/social"
)

func GenStateString() string {
        rnd := make([]byte, 32)
        rand.Read(rnd)
        return base64.StdEncoding.EncodeToString(rnd)
}

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

	error := ctx.Query("error")
	if error != "" {
		errorDesc := ctx.Query("error_description")
		ctx.Logger.Info("OAuthLogin Failed", "error", error, "errorDesc", errorDesc)
		ctx.Redirect(setting.AppSubUrl + "/login?failCode=1003")
		return
	}

	code := ctx.Query("code")
	if code == "" {
		state := GenStateString()
		ctx.Session.Set(middleware.SESS_KEY_OAUTH_STATE, state)
		ctx.Redirect(connect.AuthCodeURL(state, oauth2.AccessTypeOnline))
		return
	}

	// verify state string
	savedState := ctx.Session.Get(middleware.SESS_KEY_OAUTH_STATE).(string)
	queryState := ctx.Query("state")
	if savedState != queryState {
		ctx.Handle(500, "login.OAuthLogin(state mismatch)", nil)
		return
	}

	// handle call back
	token, err := connect.Exchange(oauth2.NoContext, code)
	if err != nil {
		ctx.Handle(500, "login.OAuthLogin(NewTransportWithCode)", err)
		return
	}

	ctx.Logger.Debug("OAuthLogin Got token")

	userInfo, err := connect.UserInfo(token)
	if err != nil {
		if err == social.ErrMissingTeamMembership {
			ctx.Redirect(setting.AppSubUrl + "/login?failCode=1000")
		} else if err == social.ErrMissingOrganizationMembership {
			ctx.Redirect(setting.AppSubUrl + "/login?failCode=1001")
		} else {
			ctx.Handle(500, fmt.Sprintf("login.OAuthLogin(get info from %s)", name), err)
		}
		return
	}

	ctx.Logger.Debug("OAuthLogin got user info", "userInfo", userInfo)

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: userInfo.Name}
	err = bus.Dispatch(&userQuery)

	// create account if missing
	if err == m.ErrUserNotFound {
		if !connect.IsSignupAllowed() {
			ctx.Redirect(setting.AppSubUrl + "/login")
			return
		}
		limitReached, err := middleware.QuotaReached(ctx, "user")
		if err != nil {
			ctx.Handle(500, "Failed to get user quota", err)
			return
		}
		if limitReached {
			ctx.Redirect(setting.AppSubUrl + "/login")
			return
		}
		cmd := m.CreateUserCommand{
			Login:          userInfo.Identity,
			Email:          userInfo.Identity,
			Name:           userInfo.Name,
			Company:        userInfo.Company,
			DefaultOrgRole: userInfo.Role,
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

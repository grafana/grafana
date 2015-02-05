package api

import (
	"net/url"

	"github.com/torkelo/grafana-pro/pkg/api/dtos"
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/setting"
	"github.com/torkelo/grafana-pro/pkg/util"
)

const (
	VIEW_INDEX = "index"
)

func LoginView(c *middleware.Context) {
	if err := setIndexViewData(c); err != nil {
		c.Handle(500, "Failed to get settings", err)
		return
	}

	settings := c.Data["Settings"].(map[string]interface{})
	settings["googleAuthEnabled"] = setting.OAuthService.Google
	settings["githubAuthEnabled"] = setting.OAuthService.GitHub
	settings["disableUserSignUp"] = setting.DisableUserSignUp

	// Check auto-login.
	uname := c.GetCookie(setting.CookieUserName)
	if len(uname) == 0 {
		c.HTML(200, VIEW_INDEX)
		return
	}

	isSucceed := false
	defer func() {
		if !isSucceed {
			log.Trace("auto-login cookie cleared: %s", uname)
			c.SetCookie(setting.CookieUserName, "", -1, setting.AppSubUrl+"/")
			c.SetCookie(setting.CookieRememberName, "", -1, setting.AppSubUrl+"/")
			return
		}
	}()

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: uname}
	if err := bus.Dispatch(&userQuery); err != nil {
		if err != m.ErrUserNotFound {
			c.Handle(500, "GetUserByLoginQuery", err)
		} else {
			c.HTML(200, VIEW_INDEX)
		}
		return
	}

	user := userQuery.Result

	if val, _ := c.GetSuperSecureCookie(
		util.EncodeMd5(user.Rands+user.Password), setting.CookieRememberName); val != user.Login {
		c.HTML(200, VIEW_INDEX)
		return
	}

	isSucceed = true
	loginUserWithUser(user, c)

	if redirectTo, _ := url.QueryUnescape(c.GetCookie("redirect_to")); len(redirectTo) > 0 {
		c.SetCookie("redirect_to", "", -1, setting.AppSubUrl+"/")
		c.Redirect(redirectTo)
		return
	}

	c.Redirect(setting.AppSubUrl + "/")
}

func LoginPost(c *middleware.Context, cmd dtos.LoginCommand) {

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: cmd.User}
	err := bus.Dispatch(&userQuery)

	if err != nil {
		c.JsonApiErr(401, "Invalid username or password", err)
		return
	}

	user := userQuery.Result

	passwordHashed := util.EncodePassword(cmd.Password, user.Salt)
	if passwordHashed != user.Password {
		c.JsonApiErr(401, "Invalid username or password", err)
		return
	}

	// default to true here for now
	cmd.Remember = true

	if cmd.Remember {
		days := 86400 * setting.LogInRememberDays
		c.SetCookie(setting.CookieUserName, user.Login, days, setting.AppSubUrl+"/")
		c.SetSuperSecureCookie(util.EncodeMd5(user.Rands+user.Password), setting.CookieRememberName, user.Login, days, setting.AppSubUrl+"/")
	}

	loginUserWithUser(user, c)

	result := map[string]interface{}{
		"message": "Logged in",
	}

	if redirectTo, _ := url.QueryUnescape(c.GetCookie("redirect_to")); len(redirectTo) > 0 {
		result["redirectUrl"] = redirectTo
		c.SetCookie("redirect_to", "", -1, setting.AppSubUrl+"/")
	}

	c.JSON(200, result)
}

func loginUserWithUser(user *m.User, c *middleware.Context) {
	if user == nil {
		log.Error(3, "User login with nil user")
	}

	c.Session.Set(middleware.SESS_KEY_USERID, user.Id)
}

func Logout(c *middleware.Context) {
	c.SetCookie(setting.CookieUserName, "", -1, setting.AppSubUrl+"/")
	c.SetCookie(setting.CookieRememberName, "", -1, setting.AppSubUrl+"/")
	c.Session.Destory(c.Context)
	c.Redirect(setting.AppSubUrl + "/login")
}

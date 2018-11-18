package api

import (
	"net/url"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/session"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	ViewIndex = "index"
)

func (hs *HTTPServer) LoginView(c *m.ReqContext) {
	viewData, err := hs.setIndexViewData(c)
	if err != nil {
		c.Handle(500, "Failed to get settings", err)
		return
	}

	enabledOAuths := make(map[string]interface{})
	for key, oauth := range setting.OAuthService.OAuthInfos {
		enabledOAuths[key] = map[string]string{"name": oauth.Name}
	}

	viewData.Settings["oauth"] = enabledOAuths
	viewData.Settings["disableUserSignUp"] = !setting.AllowUserSignUp
	viewData.Settings["loginHint"] = setting.LoginHint
	viewData.Settings["disableLoginForm"] = setting.DisableLoginForm

	if loginError, ok := c.Session.Get("loginError").(string); ok {
		c.Session.Delete("loginError")
		viewData.Settings["loginError"] = loginError
	}

	if !tryLoginUsingRememberCookie(c) {
		c.HTML(200, ViewIndex, viewData)
		return
	}

	if redirectTo, _ := url.QueryUnescape(c.GetCookie("redirect_to")); len(redirectTo) > 0 {
		c.SetCookie("redirect_to", "", -1, setting.AppSubUrl+"/")
		c.Redirect(redirectTo)
		return
	}

	c.Redirect(setting.AppSubUrl + "/")
}

func tryLoginUsingRememberCookie(c *m.ReqContext) bool {
	// Check auto-login.
	uname := c.GetCookie(setting.CookieUserName)
	if len(uname) == 0 {
		return false
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
		return false
	}

	user := userQuery.Result

	// validate remember me cookie
	signingKey := user.Rands + user.Password
	if len(signingKey) < 10 {
		c.Logger.Error("Invalid user signingKey")
		return false
	}

	if val, _ := c.GetSuperSecureCookie(signingKey, setting.CookieRememberName); val != user.Login {
		return false
	}

	isSucceed = true
	loginUserWithUser(user, c)
	return true
}

func LoginAPIPing(c *m.ReqContext) {
	if !tryLoginUsingRememberCookie(c) {
		c.JsonApiErr(401, "Unauthorized", nil)
		return
	}

	c.JsonOK("Logged in")
}

func LoginPost(c *m.ReqContext, cmd dtos.LoginCommand) Response {
	if setting.DisableLoginForm {
		return Error(401, "Login is disabled", nil)
	}

	authQuery := &m.LoginUserQuery{
		ReqContext: c,
		Username:   cmd.User,
		Password:   cmd.Password,
		IpAddress:  c.Req.RemoteAddr,
	}

	if err := bus.Dispatch(authQuery); err != nil {
		if err == login.ErrInvalidCredentials || err == login.ErrTooManyLoginAttempts {
			return Error(401, "Invalid username or password", err)
		}

		return Error(500, "Error while trying to authenticate user", err)
	}

	user := authQuery.User

	loginUserWithUser(user, c)

	result := map[string]interface{}{
		"message": "Logged in",
	}

	if redirectTo, _ := url.QueryUnescape(c.GetCookie("redirect_to")); len(redirectTo) > 0 {
		result["redirectUrl"] = redirectTo
		c.SetCookie("redirect_to", "", -1, setting.AppSubUrl+"/")
	}

	metrics.M_Api_Login_Post.Inc()

	return JSON(200, result)
}

func loginUserWithUser(user *m.User, c *m.ReqContext) {
	if user == nil {
		log.Error(3, "User login with nil user")
	}

	c.Resp.Header().Del("Set-Cookie")

	days := 86400 * setting.LogInRememberDays
	if days > 0 {
		c.SetCookie(setting.CookieUserName, user.Login, days, setting.AppSubUrl+"/")
		c.SetSuperSecureCookie(user.Rands+user.Password, setting.CookieRememberName, user.Login, days, setting.AppSubUrl+"/")
	}

	c.Session.RegenerateId(c.Context)
	c.Session.Set(session.SESS_KEY_USERID, user.Id)
}

func Logout(c *m.ReqContext) {
	c.SetCookie(setting.CookieUserName, "", -1, setting.AppSubUrl+"/")
	c.SetCookie(setting.CookieRememberName, "", -1, setting.AppSubUrl+"/")
	c.Session.Destory(c.Context)
	if setting.SignoutRedirectUrl != "" {
		c.Redirect(setting.SignoutRedirectUrl)
	} else {
		c.Redirect(setting.AppSubUrl + "/login")
	}
}

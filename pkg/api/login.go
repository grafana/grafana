package api

import (
	"net/url"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/ldapauth"
	"github.com/grafana/grafana/pkg/auth"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
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
	settings["disableUserSignUp"] = !setting.AllowUserSignUp

	if !tryLoginUsingRememberCookie(c) {
		c.HTML(200, VIEW_INDEX)
		return
	}

	if redirectTo, _ := url.QueryUnescape(c.GetCookie("redirect_to")); len(redirectTo) > 0 {
		c.SetCookie("redirect_to", "", -1, setting.AppSubUrl+"/")
		c.Redirect(redirectTo)
		return
	}

	c.Redirect(setting.AppSubUrl + "/")
}

func tryLoginUsingRememberCookie(c *middleware.Context) bool {
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
	if val, _ := c.GetSuperSecureCookie(
		util.EncodeMd5(user.Rands+user.Password), setting.CookieRememberName); val != user.Login {
		return false
	}

	isSucceed = true
	loginUserWithUser(user, c)
	return true
}

func LoginApiPing(c *middleware.Context) {
	if !tryLoginUsingRememberCookie(c) {
		c.JsonApiErr(401, "Unauthorized", nil)
		return
	}

	c.JsonOK("Logged in")
}

func LoginPost(c *middleware.Context, cmd dtos.LoginCommand) Response {
	sourcesQuery := auth.GetAuthSourcesQuery{}
	if err := bus.Dispatch(&sourcesQuery); err != nil {
		return ApiError(500, "Could not get login sources", err)
	}

	var err error
	var user *m.User

	for _, authSource := range sourcesQuery.Sources {
		user, err = authSource.AuthenticateUser(cmd.User, cmd.Password)
		if err == nil {
			break
		}
		// handle non invalid credentials error, otherwise try next auth source
		if err != auth.ErrInvalidCredentials {
			return ApiError(500, "Error while trying to authenticate user", err)
		}
	}

	if err != nil {
		return ApiError(401, "Invalid username or password", err)
	}

	loginUserWithUser(user, c)

	result := map[string]interface{}{
		"message": "Logged in",
	}

	if redirectTo, _ := url.QueryUnescape(c.GetCookie("redirect_to")); len(redirectTo) > 0 {
		result["redirectUrl"] = redirectTo
		c.SetCookie("redirect_to", "", -1, setting.AppSubUrl+"/")
	}

	metrics.M_Api_Login_Post.Inc(1)

	return Json(200, result)
}

func LoginUsingLdap(c *middleware.Context, cmd dtos.LoginCommand) Response {
	err := ldapauth.Login(cmd.User, cmd.Password)

	if err != nil {
		if err == ldapauth.ErrInvalidCredentials {
			return ApiError(401, "Invalid username or password", err)
		}
		return ApiError(500, "Ldap login failed", err)
	}

	return Empty(401)
}

func loginUserWithUser(user *m.User, c *middleware.Context) {
	if user == nil {
		log.Error(3, "User login with nil user")
	}

	days := 86400 * setting.LogInRememberDays
	c.SetCookie(setting.CookieUserName, user.Login, days, setting.AppSubUrl+"/")
	c.SetSuperSecureCookie(util.EncodeMd5(user.Rands+user.Password), setting.CookieRememberName, user.Login, days, setting.AppSubUrl+"/")

	c.Session.Set(middleware.SESS_KEY_USERID, user.Id)
}

func Logout(c *middleware.Context) {
	c.SetCookie(setting.CookieUserName, "", -1, setting.AppSubUrl+"/")
	c.SetCookie(setting.CookieRememberName, "", -1, setting.AppSubUrl+"/")
	c.Session.Destory(c)
	c.Redirect(setting.AppSubUrl + "/login")
}

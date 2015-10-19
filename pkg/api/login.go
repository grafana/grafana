package api

import (
	l "log"
	"database/sql"
	_ "github.com/go-sql-driver/mysql"
	"time"
	"strconv"

	"net/url"

	"github.com/Cepave/grafana/pkg/api/dtos"
	"github.com/Cepave/grafana/pkg/bus"
	"github.com/Cepave/grafana/pkg/log"
	"github.com/Cepave/grafana/pkg/login"
	"github.com/Cepave/grafana/pkg/metrics"
	"github.com/Cepave/grafana/pkg/middleware"
	m "github.com/Cepave/grafana/pkg/models"
	"github.com/Cepave/grafana/pkg/setting"
	"github.com/Cepave/grafana/pkg/util"
)

const (
	VIEW_INDEX = "index"
)

/**
 * @function name:	GetOpenFalconSessionUsername(sig string) string
 * @description:	This function gets user logged in if "sig" cookie of Open-Falcon is valid.
 * @related issues:	OWL-124, OWL-115, OWL-110
 * @param:			sig string
 * @return:			username string
 * @author:			Don Hsieh
 * @since:			10/07/2015
 * @last modified: 	10/16/2015
 * @called by:		func LoginWithOpenFalconCookie(c *middleware.Context) bool
 *					 in pkg/api/login.go
 */
func GetOpenFalconSessionUsername(sig string) string {
	// log.Info("sig = " + sig)
	if sig == "" {
		return ""
	}

	str := configOpenFalcon.Database.Account + ":" + configOpenFalcon.Database.Password
	str += "@tcp(" + configOpenFalcon.Database.Addr + ")/graph?charset=utf8"
	
	db, err := sql.Open("mysql", str)
	db.SetMaxOpenConns(2000)
	db.SetMaxIdleConns(1000)
	defer db.Close()

	if err != nil {
		return ""
	}
	
	stmtOut, err := db.Prepare("SELECT id, uid, expired FROM uic.session WHERE sig = ?")
	if err != nil {
		l.Println(err.Error())
		return ""
	}
	defer stmtOut.Close()

	var id int64
	var uid int64
	var expired string
	err = stmtOut.QueryRow(sig).Scan(&id, &uid, &expired) // WHERE id = endpointId
	if err != nil {
		l.Println(err.Error())
		return ""
	}
	l.Println("Expired time stamp =", expired)

	expiredTimeInt, err := strconv.ParseInt(expired, 10, 64)
	if err != nil {
		l.Println(err.Error())
		return ""
	}

	now := time.Now().Unix()
	l.Println("now =", now)
	isExpired := now > expiredTimeInt
	l.Println("isExpired =", isExpired)
	if isExpired {
		return ""
	}

	stmtOut, err = db.Prepare("SELECT name FROM uic.user WHERE id = ?")
	if err != nil {
		l.Println(err.Error())
		return ""
	}
	defer stmtOut.Close()

	var name string
	err = stmtOut.QueryRow(uid).Scan(&name) // WHERE id = endpointId
	if err != nil {
		l.Println(err.Error())
		return ""
	}
	l.Println("Session user name =", name)
	return name
}

/**
 * @function name:	func LoginWithOpenFalconCookie(c *middleware.Context) bool
 * @description:	This function gets user logged in if "sig" cookie of Open-Falcon is valid.
 * @related issues:	OWL-115, OWL-110
 * @param:			c *middleware.Context
 * @return:			bool
 * @author:			Don Hsieh
 * @since:			10/06/2015
 * @last modified: 	10/07/2015
 * @called by:		func LoginView(c *middleware.Context)
 *					 in pkg/api/login.go
 */
func LoginWithOpenFalconCookie(c *middleware.Context) bool {
	sig := c.GetCookie("sig")
	uname := GetOpenFalconSessionUsername(sig)
	if uname == "" {
		return false
	}
	
	userQuery := m.GetUserByLoginQuery{LoginOrEmail: uname}
	if err := bus.Dispatch(&userQuery); err == nil {
		user := userQuery.Result
		loginUserWithUser(user, c)
		return true
	}

	uname = "admin"
	userQuery = m.GetUserByLoginQuery{LoginOrEmail: uname}
	if err := bus.Dispatch(&userQuery); err == nil {
		user := userQuery.Result
		loginUserWithUser(user, c)
		return true
	}
	return false
}

func LoginView(c *middleware.Context) {
	isLoggedIn := LoginWithOpenFalconCookie(c)
	if isLoggedIn {
		c.Redirect(setting.AppSubUrl + "/")
		return
	}

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
	authQuery := login.LoginUserQuery{
		Username: cmd.User,
		Password: cmd.Password,
	}

	if err := bus.Dispatch(&authQuery); err != nil {
		if err == login.ErrInvalidCredentials {
			return ApiError(401, "Invalid username or password", err)
		}

		return ApiError(500, "Error while trying to authenticate user", err)
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

	metrics.M_Api_Login_Post.Inc(1)

	return Json(200, result)
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
package api

import (
	"encoding/hex"
	"net/http"
	"net/url"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const (
	ViewIndex            = "index"
	LoginErrorCookieName = "login_error"
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
	viewData.Settings["passwordHint"] = setting.PasswordHint
	viewData.Settings["disableLoginForm"] = setting.DisableLoginForm

	if loginError, ok := tryGetEncryptedCookie(c, LoginErrorCookieName); ok {
		deleteCookie(c, LoginErrorCookieName)
		viewData.Settings["loginError"] = loginError
	}

	if tryOAuthAutoLogin(c) {
		return
	}

	if !c.IsSignedIn {
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

func tryOAuthAutoLogin(c *m.ReqContext) bool {
	if !setting.OAuthAutoLogin {
		return false
	}
	oauthInfos := setting.OAuthService.OAuthInfos
	if len(oauthInfos) != 1 {
		log.Warn("Skipping OAuth auto login because multiple OAuth providers are configured.")
		return false
	}
	for key := range setting.OAuthService.OAuthInfos {
		redirectUrl := setting.AppSubUrl + "/login/" + key
		log.Info("OAuth auto login enabled. Redirecting to " + redirectUrl)
		c.Redirect(redirectUrl, 307)
		return true
	}
	return false
}

func (hs *HTTPServer) LoginAPIPing(c *m.ReqContext) Response {
	if c.IsSignedIn || c.IsAnonymous {
		return JSON(200, "Logged in")
	}

	return Error(401, "Unauthorized", nil)
}

func (hs *HTTPServer) LoginPost(c *m.ReqContext, cmd dtos.LoginCommand) Response {
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

	hs.loginUserWithUser(user, c)

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

func (hs *HTTPServer) loginUserWithUser(user *m.User, c *m.ReqContext) {
	if user == nil {
		hs.log.Error("user login with nil user")
	}

	userToken, err := hs.AuthTokenService.CreateToken(user.Id, c.RemoteAddr(), c.Req.UserAgent())
	if err != nil {
		hs.log.Error("failed to create auth token", "error", err)
	}

	middleware.WriteSessionCookie(c, userToken.UnhashedToken, hs.Cfg.LoginMaxLifetimeDays)
}

func (hs *HTTPServer) Logout(c *m.ReqContext) {
	if err := hs.AuthTokenService.RevokeToken(c.UserToken); err != nil && err != m.ErrUserTokenNotFound {
		hs.log.Error("failed to revoke auth token", "error", err)
	}

	middleware.WriteSessionCookie(c, "", -1)

	if setting.SignoutRedirectUrl != "" {
		c.Redirect(setting.SignoutRedirectUrl)
	} else {
		c.Redirect(setting.AppSubUrl + "/login")
	}
}

func tryGetEncryptedCookie(ctx *m.ReqContext, cookieName string) (string, bool) {
	cookie := ctx.GetCookie(cookieName)
	if cookie == "" {
		return "", false
	}

	decoded, err := hex.DecodeString(cookie)
	if err != nil {
		return "", false
	}

	decryptedError, err := util.Decrypt(decoded, setting.SecretKey)
	return string(decryptedError), err == nil
}

func deleteCookie(ctx *m.ReqContext, cookieName string) {
	ctx.SetCookie(cookieName, "", -1, setting.AppSubUrl+"/")
}

func (hs *HTTPServer) trySetEncryptedCookie(ctx *m.ReqContext, cookieName string, value string, maxAge int) error {
	encryptedError, err := util.Encrypt([]byte(value), setting.SecretKey)
	if err != nil {
		return err
	}

	http.SetCookie(ctx.Resp, &http.Cookie{
		Name:     cookieName,
		MaxAge:   60,
		Value:    hex.EncodeToString(encryptedError),
		HttpOnly: true,
		Path:     setting.AppSubUrl + "/",
		Secure:   hs.Cfg.CookieSecure,
		SameSite: hs.Cfg.CookieSameSite,
	})

	return nil
}

package api

import (
	"encoding/hex"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const (
	ViewIndex            = "index"
	LoginErrorCookieName = "login_error"
)

var setIndexViewData = (*HTTPServer).setIndexViewData

var getViewIndex = func() string {
	return ViewIndex
}

func (hs *HTTPServer) validateRedirectTo(redirectTo string) error {
	to, err := url.Parse(redirectTo)
	if err != nil {
		return login.ErrInvalidRedirectTo
	}
	if to.IsAbs() {
		return login.ErrAbsoluteRedirectTo
	}
	// when using a subUrl, the redirect_to should have a relative or absolute path that includes the subUrl, otherwise the redirect
	// will send the user to the wrong location
	if hs.Cfg.AppSubUrl != "" && !strings.HasPrefix(to.Path, hs.Cfg.AppSubUrl) && !strings.HasPrefix(to.Path, "/"+hs.Cfg.AppSubUrl) {
		return login.ErrInvalidRedirectTo
	}
	return nil
}

func (hs *HTTPServer) cookieOptionsFromCfg() middleware.CookieOptions {
	return middleware.CookieOptions{
		Path:             hs.Cfg.AppSubUrl + "/",
		Secure:           hs.Cfg.CookieSecure,
		SameSiteDisabled: hs.Cfg.CookieSameSiteDisabled,
		SameSiteMode:     hs.Cfg.CookieSameSiteMode,
	}
}

func (hs *HTTPServer) LoginView(c *models.ReqContext) {
	viewData, err := setIndexViewData(hs, c)
	if err != nil {
		c.Handle(500, "Failed to get settings", err)
		return
	}

	enabledOAuths := make(map[string]interface{})
	for key, oauth := range setting.OAuthService.OAuthInfos {
		enabledOAuths[key] = map[string]string{"name": oauth.Name}
	}

	viewData.Settings["oauth"] = enabledOAuths
	viewData.Settings["samlEnabled"] = hs.License.HasValidLicense() && hs.Cfg.SAMLEnabled

	if loginError, ok := tryGetEncryptedCookie(c, LoginErrorCookieName); ok {
		//this cookie is only set whenever an OAuth login fails
		//therefore the loginError should be passed to the view data
		//and the view should return immediately before attempting
		//to login again via OAuth and enter to a redirect loop
		middleware.DeleteCookie(c.Resp, LoginErrorCookieName, hs.cookieOptionsFromCfg)
		viewData.Settings["loginError"] = loginError
		c.HTML(200, getViewIndex(), viewData)
		return
	}

	if tryOAuthAutoLogin(c) {
		return
	}

	if c.IsSignedIn {
		// Assign login token to auth proxy users if enable_login_token = true
		if setting.AuthProxyEnabled && setting.AuthProxyEnableLoginToken {
			hs.loginAuthProxyUser(c)
		}

		if redirectTo, _ := url.QueryUnescape(c.GetCookie("redirect_to")); len(redirectTo) > 0 {
			if err := hs.validateRedirectTo(redirectTo); err != nil {
				viewData.Settings["loginError"] = err.Error()
				c.HTML(200, getViewIndex(), viewData)
				middleware.DeleteCookie(c.Resp, "redirect_to", hs.cookieOptionsFromCfg)
				return
			}
			middleware.DeleteCookie(c.Resp, "redirect_to", hs.cookieOptionsFromCfg)
			c.Redirect(redirectTo)
			return
		}

		c.Redirect(setting.AppSubUrl + "/")
		return
	}

	c.HTML(200, getViewIndex(), viewData)
}

func (hs *HTTPServer) loginAuthProxyUser(c *models.ReqContext) {
	hs.loginUserWithUser(&models.User{
		Id:    c.SignedInUser.UserId,
		Email: c.SignedInUser.Email,
		Login: c.SignedInUser.Login,
	}, c)
}

func tryOAuthAutoLogin(c *models.ReqContext) bool {
	if !setting.OAuthAutoLogin {
		return false
	}
	oauthInfos := setting.OAuthService.OAuthInfos
	if len(oauthInfos) != 1 {
		log.Warn("Skipping OAuth auto login because multiple OAuth providers are configured")
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

func (hs *HTTPServer) LoginAPIPing(c *models.ReqContext) Response {
	if c.IsSignedIn || c.IsAnonymous {
		return JSON(200, "Logged in")
	}

	return Error(401, "Unauthorized", nil)
}

func (hs *HTTPServer) LoginPost(c *models.ReqContext, cmd dtos.LoginCommand) Response {
	if setting.DisableLoginForm {
		return Error(401, "Login is disabled", nil)
	}

	authQuery := &models.LoginUserQuery{
		ReqContext: c,
		Username:   cmd.User,
		Password:   cmd.Password,
		IpAddress:  c.Req.RemoteAddr,
	}

	if err := bus.Dispatch(authQuery); err != nil {
		e401 := Error(401, "Invalid username or password", err)
		if err == login.ErrInvalidCredentials || err == login.ErrTooManyLoginAttempts {
			return e401
		}

		// Do not expose disabled status,
		// just show incorrect user credentials error (see #17947)
		if err == login.ErrUserDisabled {
			hs.log.Warn("User is disabled", "user", cmd.User)
			return e401
		}

		return Error(500, "Error while trying to authenticate user", err)
	}

	user := authQuery.User

	hs.loginUserWithUser(user, c)

	result := map[string]interface{}{
		"message": "Logged in",
	}

	if redirectTo, _ := url.QueryUnescape(c.GetCookie("redirect_to")); len(redirectTo) > 0 {
		if err := hs.validateRedirectTo(redirectTo); err == nil {
			// remove subpath if it exists at the beginning of the redirect_to
			// LoginCtrl.tsx is already prepending the redirectUrl with the subpath
			if setting.AppSubUrl != "" && strings.Index(redirectTo, setting.AppSubUrl) == 0 {
				redirectTo = strings.Replace(redirectTo, setting.AppSubUrl, "", 1)
			}
			result["redirectUrl"] = redirectTo
		} else {
			log.Info("Ignored invalid redirect_to cookie value: %v", redirectTo)
		}
		middleware.DeleteCookie(c.Resp, "redirect_to", hs.cookieOptionsFromCfg)
	}

	metrics.MApiLoginPost.Inc()
	return JSON(200, result)
}

func (hs *HTTPServer) loginUserWithUser(user *models.User, c *models.ReqContext) {
	if user == nil {
		hs.log.Error("user login with nil user")
	}

	userToken, err := hs.AuthTokenService.CreateToken(c.Req.Context(), user.Id, c.RemoteAddr(), c.Req.UserAgent())
	if err != nil {
		hs.log.Error("failed to create auth token", "error", err)
	}
	hs.log.Info("Successful Login", "User", user.Email)
	middleware.WriteSessionCookie(c, userToken.UnhashedToken, hs.Cfg.LoginMaxLifetimeDays)
}

func (hs *HTTPServer) Logout(c *models.ReqContext) {
	if err := hs.AuthTokenService.RevokeToken(c.Req.Context(), c.UserToken); err != nil && err != models.ErrUserTokenNotFound {
		hs.log.Error("failed to revoke auth token", "error", err)
	}

	middleware.WriteSessionCookie(c, "", -1)

	if setting.SignoutRedirectUrl != "" {
		c.Redirect(setting.SignoutRedirectUrl)
	} else {
		hs.log.Info("Successful Logout", "User", c.Email)
		c.Redirect(setting.AppSubUrl + "/login")
	}
}

func tryGetEncryptedCookie(ctx *models.ReqContext, cookieName string) (string, bool) {
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

func (hs *HTTPServer) trySetEncryptedCookie(ctx *models.ReqContext, cookieName string, value string, maxAge int) error {
	encryptedError, err := util.Encrypt([]byte(value), setting.SecretKey)
	if err != nil {
		return err
	}

	middleware.WriteCookie(ctx.Resp, cookieName, hex.EncodeToString(encryptedError), 60, hs.cookieOptionsFromCfg)

	return nil
}

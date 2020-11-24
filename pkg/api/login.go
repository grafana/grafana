package api

import (
	"encoding/hex"
	"errors"
	"net/http"
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
	"github.com/grafana/grafana/pkg/util/errutil"
)

const (
	ViewIndex            = "index"
	LoginErrorCookieName = "login_error"
)

var setIndexViewData = (*HTTPServer).setIndexViewData

var getViewIndex = func() string {
	return ViewIndex
}

func (hs *HTTPServer) ValidateRedirectTo(redirectTo string) error {
	to, err := url.Parse(redirectTo)
	if err != nil {
		return login.ErrInvalidRedirectTo
	}
	if to.IsAbs() {
		return login.ErrAbsoluteRedirectTo
	}

	if to.Host != "" {
		return login.ErrForbiddenRedirectTo
	}

	// path should have exactly one leading slash
	if !strings.HasPrefix(to.Path, "/") {
		return login.ErrForbiddenRedirectTo
	}
	if strings.HasPrefix(to.Path, "//") {
		return login.ErrForbiddenRedirectTo
	}

	// when using a subUrl, the redirect_to should start with the subUrl (which contains the leading slash), otherwise the redirect
	// will send the user to the wrong location
	if hs.Cfg.AppSubUrl != "" && !strings.HasPrefix(to.Path, hs.Cfg.AppSubUrl+"/") {
		return login.ErrInvalidRedirectTo
	}

	return nil
}

func (hs *HTTPServer) CookieOptionsFromCfg() middleware.CookieOptions {
	path := "/"
	if len(hs.Cfg.AppSubUrl) > 0 {
		path = hs.Cfg.AppSubUrl
	}
	return middleware.CookieOptions{
		Path:             path,
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
		// this cookie is only set whenever an OAuth login fails
		// therefore the loginError should be passed to the view data
		// and the view should return immediately before attempting
		// to login again via OAuth and enter to a redirect loop
		middleware.DeleteCookie(c.Resp, LoginErrorCookieName, hs.CookieOptionsFromCfg)
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
			user := &models.User{Id: c.SignedInUser.UserId, Email: c.SignedInUser.Email, Login: c.SignedInUser.Login}
			err := hs.loginUserWithUser(user, c)
			if err != nil {
				c.Handle(500, "Failed to sign in user", err)
				return
			}
		}

		if redirectTo := c.GetCookie("redirect_to"); len(redirectTo) > 0 {
			if err := hs.ValidateRedirectTo(redirectTo); err != nil {
				// the user is already logged so instead of rendering the login page with error
				// it should be redirected to the home page.
				log.Debugf("Ignored invalid redirect_to cookie value: %v", redirectTo)
				redirectTo = hs.Cfg.AppSubUrl + "/"
			}
			middleware.DeleteCookie(c.Resp, "redirect_to", hs.CookieOptionsFromCfg)
			c.Redirect(redirectTo)
			return
		}

		c.Redirect(setting.AppSubUrl + "/")
		return
	}

	c.HTML(200, getViewIndex(), viewData)
}

func tryOAuthAutoLogin(c *models.ReqContext) bool {
	if !setting.OAuthAutoLogin {
		return false
	}
	oauthInfos := setting.OAuthService.OAuthInfos
	if len(oauthInfos) != 1 {
		log.Warnf("Skipping OAuth auto login because multiple OAuth providers are configured")
		return false
	}
	for key := range setting.OAuthService.OAuthInfos {
		redirectUrl := setting.AppSubUrl + "/login/" + key
		log.Infof("OAuth auto login enabled. Redirecting to " + redirectUrl)
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
	authModule := ""
	var user *models.User
	var response *NormalResponse

	defer func() {
		err := response.err
		if err == nil && response.errMessage != "" {
			err = errors.New(response.errMessage)
		}
		hs.HooksService.RunLoginHook(&models.LoginInfo{
			AuthModule:    authModule,
			User:          user,
			LoginUsername: cmd.User,
			HTTPStatus:    response.status,
			Error:         err,
		}, c)
	}()

	if setting.DisableLoginForm {
		response = Error(http.StatusUnauthorized, "Login is disabled", nil)
		return response
	}

	authQuery := &models.LoginUserQuery{
		ReqContext: c,
		Username:   cmd.User,
		Password:   cmd.Password,
		IpAddress:  c.Req.RemoteAddr,
	}

	err := bus.Dispatch(authQuery)
	authModule = authQuery.AuthModule
	if err != nil {
		response = Error(401, "Invalid username or password", err)
		if err == login.ErrInvalidCredentials || err == login.ErrTooManyLoginAttempts || err == models.ErrUserNotFound {
			return response
		}

		// Do not expose disabled status,
		// just show incorrect user credentials error (see #17947)
		if err == login.ErrUserDisabled {
			hs.log.Warn("User is disabled", "user", cmd.User)
			return response
		}

		response = Error(500, "Error while trying to authenticate user", err)
		return response
	}

	user = authQuery.User

	err = hs.loginUserWithUser(user, c)
	if err != nil {
		response = Error(http.StatusInternalServerError, "Error while signing in user", err)
		return response
	}

	result := map[string]interface{}{
		"message": "Logged in",
	}

	if redirectTo := c.GetCookie("redirect_to"); len(redirectTo) > 0 {
		if err := hs.ValidateRedirectTo(redirectTo); err == nil {
			result["redirectUrl"] = redirectTo
		} else {
			log.Infof("Ignored invalid redirect_to cookie value: %v", redirectTo)
		}
		middleware.DeleteCookie(c.Resp, "redirect_to", hs.CookieOptionsFromCfg)
	}

	metrics.MApiLoginPost.Inc()
	response = JSON(http.StatusOK, result)
	return response
}

func (hs *HTTPServer) loginUserWithUser(user *models.User, c *models.ReqContext) error {
	if user == nil {
		return errors.New("could not login user")
	}

	userToken, err := hs.AuthTokenService.CreateToken(c.Req.Context(), user.Id, c.RemoteAddr(), c.Req.UserAgent())
	if err != nil {
		return errutil.Wrap("failed to create auth token", err)
	}

	hs.log.Info("Successful Login", "User", user.Email)
	middleware.WriteSessionCookie(c, userToken.UnhashedToken, hs.Cfg.LoginMaxLifetime)
	return nil
}

func (hs *HTTPServer) Logout(c *models.ReqContext) {
	if hs.Cfg.SAMLEnabled && hs.Cfg.SAMLSingleLogoutEnabled {
		c.Redirect(setting.AppSubUrl + "/logout/saml")
		return
	}

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

	middleware.WriteCookie(ctx.Resp, cookieName, hex.EncodeToString(encryptedError), 60, hs.CookieOptionsFromCfg)

	return nil
}

func (hs *HTTPServer) redirectWithError(ctx *models.ReqContext, err error, v ...interface{}) {
	ctx.Logger.Error(err.Error(), v...)
	if err := hs.trySetEncryptedCookie(ctx, LoginErrorCookieName, err.Error(), 60); err != nil {
		hs.log.Error("Failed to set encrypted cookie", "err", err)
	}

	ctx.Redirect(setting.AppSubUrl + "/login")
}

func (hs *HTTPServer) RedirectResponseWithError(ctx *models.ReqContext, err error, v ...interface{}) *RedirectResponse {
	ctx.Logger.Error(err.Error(), v...)
	if err := hs.trySetEncryptedCookie(ctx, LoginErrorCookieName, err.Error(), 60); err != nil {
		hs.log.Error("Failed to set encrypted cookie", "err", err)
	}

	return Redirect(setting.AppSubUrl + "/login")
}

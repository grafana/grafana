package api

import (
	"context"
	"encoding/hex"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

const (
	viewIndex            = "index"
	loginErrorCookieName = "login_error"
)

var setIndexViewData = (*HTTPServer).setIndexViewData

var getViewIndex = func() string {
	return viewIndex
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
	if hs.Cfg.AppSubURL != "" && !strings.HasPrefix(to.Path, hs.Cfg.AppSubURL+"/") {
		return login.ErrInvalidRedirectTo
	}

	return nil
}

func (hs *HTTPServer) CookieOptionsFromCfg() cookies.CookieOptions {
	path := "/"
	if len(hs.Cfg.AppSubURL) > 0 {
		path = hs.Cfg.AppSubURL
	}
	return cookies.CookieOptions{
		Path:             path,
		Secure:           hs.Cfg.CookieSecure,
		SameSiteDisabled: hs.Cfg.CookieSameSiteDisabled,
		SameSiteMode:     hs.Cfg.CookieSameSiteMode,
	}
}

func (hs *HTTPServer) LoginView(c *models.ReqContext) {
	viewData, err := setIndexViewData(hs, c)
	if err != nil {
		c.Handle(hs.Cfg, 500, "Failed to get settings", err)
		return
	}

	urlParams := c.Req.URL.Query()
	if _, disableAutoLogin := urlParams["disableAutoLogin"]; disableAutoLogin {
		hs.log.Debug("Auto login manually disabled")
		c.HTML(200, getViewIndex(), viewData)
		return
	}

	enabledOAuths := make(map[string]interface{})
	providers := hs.SocialService.GetOAuthInfoProviders()
	for key, oauth := range providers {
		enabledOAuths[key] = map[string]string{"name": oauth.Name}
	}

	viewData.Settings["oauth"] = enabledOAuths
	viewData.Settings["samlEnabled"] = hs.samlEnabled()

	if loginError, ok := tryGetEncryptedCookie(c, loginErrorCookieName); ok {
		// this cookie is only set whenever an OAuth login fails
		// therefore the loginError should be passed to the view data
		// and the view should return immediately before attempting
		// to login again via OAuth and enter to a redirect loop
		cookies.DeleteCookie(c.Resp, loginErrorCookieName, hs.CookieOptionsFromCfg)
		viewData.Settings["loginError"] = loginError
		c.HTML(200, getViewIndex(), viewData)
		return
	}

	if hs.tryOAuthAutoLogin(c) {
		return
	}

	if c.IsSignedIn {
		// Assign login token to auth proxy users if enable_login_token = true
		if hs.Cfg.AuthProxyEnabled && hs.Cfg.AuthProxyEnableLoginToken {
			user := &models.User{Id: c.SignedInUser.UserId, Email: c.SignedInUser.Email, Login: c.SignedInUser.Login}
			err := hs.loginUserWithUser(user, c)
			if err != nil {
				c.Handle(hs.Cfg, 500, "Failed to sign in user", err)
				return
			}
		}

		if redirectTo := c.GetCookie("redirect_to"); len(redirectTo) > 0 {
			if err := hs.ValidateRedirectTo(redirectTo); err != nil {
				// the user is already logged so instead of rendering the login page with error
				// it should be redirected to the home page.
				log.Debugf("Ignored invalid redirect_to cookie value: %v", redirectTo)
				redirectTo = hs.Cfg.AppSubURL + "/"
			}
			cookies.DeleteCookie(c.Resp, "redirect_to", hs.CookieOptionsFromCfg)
			c.Redirect(redirectTo)
			return
		}

		c.Redirect(hs.Cfg.AppSubURL + "/")
		return
	}

	c.HTML(200, getViewIndex(), viewData)
}

func (hs *HTTPServer) tryOAuthAutoLogin(c *models.ReqContext) bool {
	if !setting.OAuthAutoLogin {
		return false
	}
	oauthInfos := hs.SocialService.GetOAuthInfoProviders()
	if len(oauthInfos) != 1 {
		log.Warnf("Skipping OAuth auto login because multiple OAuth providers are configured")
		return false
	}
	for key := range oauthInfos {
		redirectUrl := hs.Cfg.AppSubURL + "/login/" + key
		log.Infof("OAuth auto login enabled. Redirecting to " + redirectUrl)
		c.Redirect(redirectUrl, 307)
		return true
	}
	return false
}

func (hs *HTTPServer) LoginAPIPing(c *models.ReqContext) response.Response {
	if c.IsSignedIn || c.IsAnonymous {
		return response.JSON(200, "Logged in")
	}

	return response.Error(401, "Unauthorized", nil)
}

func (hs *HTTPServer) LoginPost(c *models.ReqContext, cmd dtos.LoginCommand) response.Response {
	authModule := ""
	var user *models.User
	var resp *response.NormalResponse

	defer func() {
		err := resp.Err()
		if err == nil && resp.ErrMessage() != "" {
			err = errors.New(resp.ErrMessage())
		}
		hs.HooksService.RunLoginHook(&models.LoginInfo{
			AuthModule:    authModule,
			User:          user,
			LoginUsername: cmd.User,
			HTTPStatus:    resp.Status(),
			Error:         err,
		}, c)
	}()

	if setting.DisableLoginForm {
		resp = response.Error(http.StatusUnauthorized, "Login is disabled", nil)
		return resp
	}

	authQuery := &models.LoginUserQuery{
		ReqContext: c,
		Username:   cmd.User,
		Password:   cmd.Password,
		IpAddress:  c.Req.RemoteAddr,
		Cfg:        hs.Cfg,
	}

	err := bus.Dispatch(authQuery)
	authModule = authQuery.AuthModule
	if err != nil {
		resp = response.Error(401, "Invalid username or password", err)
		if errors.Is(err, login.ErrInvalidCredentials) || errors.Is(err, login.ErrTooManyLoginAttempts) || errors.Is(err,
			models.ErrUserNotFound) {
			return resp
		}

		// Do not expose disabled status,
		// just show incorrect user credentials error (see #17947)
		if errors.Is(err, login.ErrUserDisabled) {
			hs.log.Warn("User is disabled", "user", cmd.User)
			return resp
		}

		resp = response.Error(500, "Error while trying to authenticate user", err)
		return resp
	}

	user = authQuery.User

	err = hs.loginUserWithUser(user, c)
	if err != nil {
		var createTokenErr *models.CreateTokenErr
		if errors.As(err, &createTokenErr) {
			resp = response.Error(createTokenErr.StatusCode, createTokenErr.ExternalErr, createTokenErr.InternalErr)
		} else {
			resp = response.Error(http.StatusInternalServerError, "Error while signing in user", err)
		}
		return resp
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
		cookies.DeleteCookie(c.Resp, "redirect_to", hs.CookieOptionsFromCfg)
	}

	metrics.MApiLoginPost.Inc()
	resp = response.JSON(http.StatusOK, result)
	return resp
}

func (hs *HTTPServer) loginUserWithUser(user *models.User, c *models.ReqContext) error {
	if user == nil {
		return errors.New("could not login user")
	}

	addr := c.RemoteAddr()
	ip, err := network.GetIPFromAddress(addr)
	if err != nil {
		hs.log.Debug("Failed to get IP from client address", "addr", addr)
		ip = nil
	}

	hs.log.Debug("Got IP address from client address", "addr", addr, "ip", ip)
	ctx := context.WithValue(c.Req.Context(), models.RequestURIKey{}, c.Req.RequestURI)
	userToken, err := hs.AuthTokenService.CreateToken(ctx, user, ip, c.Req.UserAgent())
	if err != nil {
		return errutil.Wrap("failed to create auth token", err)
	}
	c.UserToken = userToken

	hs.log.Info("Successful Login", "User", user.Email)
	cookies.WriteSessionCookie(c, hs.Cfg, userToken.UnhashedToken, hs.Cfg.LoginMaxLifetime)
	return nil
}

func (hs *HTTPServer) Logout(c *models.ReqContext) {
	if hs.samlSingleLogoutEnabled() {
		c.Redirect(hs.Cfg.AppSubURL + "/logout/saml")
		return
	}

	err := hs.AuthTokenService.RevokeToken(c.Req.Context(), c.UserToken, false)
	if err != nil && !errors.Is(err, models.ErrUserTokenNotFound) {
		hs.log.Error("failed to revoke auth token", "error", err)
	}

	cookies.WriteSessionCookie(c, hs.Cfg, "", -1)

	if setting.SignoutRedirectUrl != "" {
		c.Redirect(setting.SignoutRedirectUrl)
	} else {
		hs.log.Info("Successful Logout", "User", c.Email)
		c.Redirect(hs.Cfg.AppSubURL + "/login")
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

	cookies.WriteCookie(ctx.Resp, cookieName, hex.EncodeToString(encryptedError), 60, hs.CookieOptionsFromCfg)

	return nil
}

func (hs *HTTPServer) redirectWithError(ctx *models.ReqContext, err error, v ...interface{}) {
	ctx.Logger.Error(err.Error(), v...)
	if err := hs.trySetEncryptedCookie(ctx, loginErrorCookieName, getLoginExternalError(err), 60); err != nil {
		hs.log.Error("Failed to set encrypted cookie", "err", err)
	}

	ctx.Redirect(hs.Cfg.AppSubURL + "/login")
}

func (hs *HTTPServer) RedirectResponseWithError(ctx *models.ReqContext, err error, v ...interface{}) *response.RedirectResponse {
	ctx.Logger.Error(err.Error(), v...)
	if err := hs.trySetEncryptedCookie(ctx, loginErrorCookieName, getLoginExternalError(err), 60); err != nil {
		hs.log.Error("Failed to set encrypted cookie", "err", err)
	}

	return response.Redirect(hs.Cfg.AppSubURL + "/login")
}

func (hs *HTTPServer) samlEnabled() bool {
	return hs.SettingsProvider.KeyValue("auth.saml", "enabled").MustBool(false) && hs.License.HasValidLicense()
}

func (hs *HTTPServer) samlSingleLogoutEnabled() bool {
	return hs.SettingsProvider.KeyValue("auth.saml", "single_logout").MustBool(false) && hs.samlEnabled()
}

func getLoginExternalError(err error) string {
	var createTokenErr *models.CreateTokenErr
	if errors.As(err, &createTokenErr) {
		return createTokenErr.ExternalErr
	}

	return err.Error()
}

package api

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	loginservice "github.com/grafana/grafana/pkg/services/login"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/web"
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

func (hs *HTTPServer) LoginView(c *contextmodel.ReqContext) {
	if hs.Features.IsEnabled(featuremgmt.FlagClientTokenRotation) {
		if errors.Is(c.LookupTokenErr, authn.ErrTokenNeedsRotation) {
			c.Redirect(hs.Cfg.AppSubURL + "/")
			return
		}
	}

	viewData, err := setIndexViewData(hs, c)
	if err != nil {
		c.Handle(hs.Cfg, 500, "Failed to get settings", err)
		return
	}

	urlParams := c.Req.URL.Query()
	if _, disableAutoLogin := urlParams["disableAutoLogin"]; disableAutoLogin {
		hs.log.Debug("Auto login manually disabled")
		c.HTML(http.StatusOK, getViewIndex(), viewData)
		return
	}

	if loginError, ok := hs.tryGetEncryptedCookie(c, loginErrorCookieName); ok {
		// this cookie is only set whenever an OAuth login fails
		// therefore the loginError should be passed to the view data
		// and the view should return immediately before attempting
		// to login again via OAuth and enter to a redirect loop
		cookies.DeleteCookie(c.Resp, loginErrorCookieName, hs.CookieOptionsFromCfg)
		viewData.Settings.LoginError = loginError
		c.HTML(http.StatusOK, getViewIndex(), viewData)
		return
	}

	if hs.tryAutoLogin(c) {
		return
	}

	if c.IsSignedIn {
		// Assign login token to auth proxy users if enable_login_token = true
		if hs.Cfg.AuthProxyEnabled && hs.Cfg.AuthProxyEnableLoginToken {
			user := &user.User{ID: c.SignedInUser.UserID, Email: c.SignedInUser.Email, Login: c.SignedInUser.Login}
			err := hs.loginUserWithUser(user, c)
			if err != nil {
				c.Handle(hs.Cfg, http.StatusInternalServerError, "Failed to sign in user", err)
				return
			}
		}

		c.Redirect(hs.GetRedirectURL(c))
		return
	}

	c.HTML(http.StatusOK, getViewIndex(), viewData)
}

func (hs *HTTPServer) tryAutoLogin(c *contextmodel.ReqContext) bool {
	samlAutoLogin := hs.samlAutoLoginEnabled()
	oauthInfos := hs.SocialService.GetOAuthInfoProviders()

	autoLoginProvidersLen := 0
	for _, provider := range oauthInfos {
		if provider.AutoLogin {
			autoLoginProvidersLen++
		}
	}
	// If no auto_login option configured for specific OAuth, use legacy option
	if hs.Cfg.OAuthAutoLogin && autoLoginProvidersLen == 0 {
		autoLoginProvidersLen = len(oauthInfos)
	}

	if samlAutoLogin {
		autoLoginProvidersLen++
	}

	if autoLoginProvidersLen > 1 {
		c.Logger.Warn("Skipping auto login because multiple auth providers are configured with auto_login option")
		return false
	}

	if hs.Cfg.OAuthAutoLogin && autoLoginProvidersLen == 0 {
		c.Logger.Warn("Skipping auto login because no auth providers are configured")
		return false
	}

	for providerName, provider := range oauthInfos {
		if provider.AutoLogin || hs.Cfg.OAuthAutoLogin {
			redirectUrl := hs.Cfg.AppSubURL + "/login/" + providerName
			c.Logger.Info("OAuth auto login enabled. Redirecting to " + redirectUrl)
			c.Redirect(redirectUrl, 307)
			return true
		}
	}

	if samlAutoLogin {
		redirectUrl := hs.Cfg.AppSubURL + "/login/saml"
		c.Logger.Info("SAML auto login enabled. Redirecting to " + redirectUrl)
		c.Redirect(redirectUrl, 307)
		return true
	}

	return false
}

func (hs *HTTPServer) LoginAPIPing(c *contextmodel.ReqContext) response.Response {
	if c.IsSignedIn || c.IsAnonymous {
		return response.JSON(http.StatusOK, util.DynMap{"message": "Logged in"})
	}

	return response.Error(401, "Unauthorized", nil)
}

func (hs *HTTPServer) LoginPost(c *contextmodel.ReqContext) response.Response {
	if hs.Cfg.AuthBrokerEnabled {
		identity, err := hs.authnService.Login(c.Req.Context(), authn.ClientForm, &authn.Request{HTTPRequest: c.Req, Resp: c.Resp})
		if err != nil {
			tokenErr := &auth.CreateTokenErr{}
			if errors.As(err, &tokenErr) {
				return response.Error(tokenErr.StatusCode, tokenErr.ExternalErr, tokenErr.InternalErr)
			}
			return response.Err(err)
		}

		metrics.MApiLoginPost.Inc()
		return authn.HandleLoginResponse(c.Req, c.Resp, hs.Cfg, identity, hs.ValidateRedirectTo)
	}

	cmd := dtos.LoginCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad login data", err)
	}
	authModule := ""
	var usr *user.User
	var resp *response.NormalResponse

	defer func() {
		err := resp.Err()
		if err == nil && resp.ErrMessage() != "" {
			err = errors.New(resp.ErrMessage())
		}
		hs.HooksService.RunLoginHook(&loginservice.LoginInfo{
			AuthModule:    authModule,
			User:          usr,
			LoginUsername: cmd.User,
			HTTPStatus:    resp.Status(),
			Error:         err,
		}, c)
	}()

	if hs.Cfg.DisableLoginForm {
		resp = response.Error(http.StatusUnauthorized, "Login is disabled", nil)
		return resp
	}

	authQuery := &loginservice.LoginUserQuery{
		ReqContext: c,
		Username:   cmd.User,
		Password:   cmd.Password,
		IpAddress:  c.RemoteAddr(),
		Cfg:        hs.Cfg,
	}

	err := hs.authenticator.AuthenticateUser(c.Req.Context(), authQuery)
	authModule = authQuery.AuthModule
	if err != nil {
		resp = response.Error(401, "Invalid username or password", err)
		if errors.Is(err, login.ErrInvalidCredentials) || errors.Is(err, login.ErrTooManyLoginAttempts) || errors.Is(err,
			user.ErrUserNotFound) {
			return resp
		}

		if errors.Is(err, login.ErrNoAuthProvider) {
			resp = response.Error(http.StatusInternalServerError, "No authorization providers enabled", err)
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

	usr = authQuery.User

	err = hs.loginUserWithUser(usr, c)
	if err != nil {
		var createTokenErr *auth.CreateTokenErr
		if errors.As(err, &createTokenErr) {
			resp = response.Error(createTokenErr.StatusCode, createTokenErr.ExternalErr, createTokenErr.InternalErr)
		} else {
			resp = response.Error(http.StatusInternalServerError, "Error while signing in user", err)
		}
		return resp
	}

	metrics.MApiLoginPost.Inc()
	resp = response.JSON(http.StatusOK, map[string]any{
		"message":     "Logged in",
		"redirectUrl": hs.GetRedirectURL(c),
	})
	return resp
}

func (hs *HTTPServer) loginUserWithUser(user *user.User, c *contextmodel.ReqContext) error {
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
	ctx := context.WithValue(c.Req.Context(), loginservice.RequestURIKey{}, c.Req.RequestURI)
	userToken, err := hs.AuthTokenService.CreateToken(ctx, user, ip, c.Req.UserAgent())
	if err != nil {
		return fmt.Errorf("%v: %w", "failed to create auth token", err)
	}
	c.UserToken = userToken

	hs.log.Info("Successful Login", "User", user.Email)
	authn.WriteSessionCookie(c.Resp, hs.Cfg, userToken)
	return nil
}

func (hs *HTTPServer) Logout(c *contextmodel.ReqContext) {
	// If SAML is enabled and this is a SAML user use saml logout
	if hs.samlSingleLogoutEnabled() {
		getAuthQuery := loginservice.GetAuthInfoQuery{UserId: c.UserID}
		if authInfo, err := hs.authInfoService.GetAuthInfo(c.Req.Context(), &getAuthQuery); err == nil {
			if authInfo.AuthModule == loginservice.SAMLAuthModule {
				c.Redirect(hs.Cfg.AppSubURL + "/logout/saml")
				return
			}
		}
	}

	// Invalidate the OAuth tokens in case the User logged in with OAuth or the last external AuthEntry is an OAuth one
	if entry, exists, _ := hs.oauthTokenService.HasOAuthEntry(c.Req.Context(), c.SignedInUser); exists {
		if err := hs.oauthTokenService.InvalidateOAuthTokens(c.Req.Context(), entry); err != nil {
			hs.log.Warn("failed to invalidate oauth tokens for user", "userId", c.UserID, "error", err)
		}
	}

	err := hs.AuthTokenService.RevokeToken(c.Req.Context(), c.UserToken, false)
	if err != nil && !errors.Is(err, auth.ErrUserTokenNotFound) {
		hs.log.Error("failed to revoke auth token", "error", err)
	}

	authn.DeleteSessionCookie(c.Resp, hs.Cfg)

	if setting.SignoutRedirectUrl != "" {
		c.Redirect(setting.SignoutRedirectUrl)
	} else {
		hs.log.Info("Successful Logout", "User", c.Email)
		c.Redirect(hs.Cfg.AppSubURL + "/login")
	}
}

func (hs *HTTPServer) tryGetEncryptedCookie(ctx *contextmodel.ReqContext, cookieName string) (string, bool) {
	cookie := ctx.GetCookie(cookieName)
	if cookie == "" {
		return "", false
	}

	decoded, err := hex.DecodeString(cookie)
	if err != nil {
		return "", false
	}

	decryptedError, err := hs.SecretsService.Decrypt(ctx.Req.Context(), decoded)
	return string(decryptedError), err == nil
}

func (hs *HTTPServer) trySetEncryptedCookie(ctx *contextmodel.ReqContext, cookieName string, value string, maxAge int) error {
	encryptedError, err := hs.SecretsService.Encrypt(ctx.Req.Context(), []byte(value), secrets.WithoutScope())
	if err != nil {
		return err
	}

	cookies.WriteCookie(ctx.Resp, cookieName, hex.EncodeToString(encryptedError), 60, hs.CookieOptionsFromCfg)

	return nil
}

func (hs *HTTPServer) redirectWithError(c *contextmodel.ReqContext, err error, v ...interface{}) {
	c.Logger.Warn(err.Error(), v...)
	c.Redirect(hs.redirectURLWithErrorCookie(c, err))
}

func (hs *HTTPServer) RedirectResponseWithError(c *contextmodel.ReqContext, err error, v ...interface{}) *response.RedirectResponse {
	c.Logger.Error(err.Error(), v...)
	location := hs.redirectURLWithErrorCookie(c, err)
	return response.Redirect(location)
}

func (hs *HTTPServer) redirectURLWithErrorCookie(c *contextmodel.ReqContext, err error) string {
	setCookie := true
	if hs.Features.IsEnabled(featuremgmt.FlagIndividualCookiePreferences) {
		prefsQuery := pref.GetPreferenceWithDefaultsQuery{UserID: c.UserID, OrgID: c.OrgID, Teams: c.Teams}
		prefs, err := hs.preferenceService.GetWithDefaults(c.Req.Context(), &prefsQuery)
		if err != nil {
			c.Redirect(hs.Cfg.AppSubURL + "/login")
		}
		setCookie = prefs.Cookies("functional")
	}

	if setCookie {
		if err := hs.trySetEncryptedCookie(c, loginErrorCookieName, getLoginExternalError(err), 60); err != nil {
			hs.log.Error("Failed to set encrypted cookie", "err", err)
		}
	}

	return hs.Cfg.AppSubURL + "/login"
}

func (hs *HTTPServer) samlEnabled() bool {
	return hs.SettingsProvider.KeyValue("auth.saml", "enabled").MustBool(false) && hs.License.FeatureEnabled("saml")
}

func (hs *HTTPServer) samlName() string {
	return hs.SettingsProvider.KeyValue("auth.saml", "name").MustString("SAML")
}

func (hs *HTTPServer) samlSingleLogoutEnabled() bool {
	return hs.samlEnabled() && hs.SettingsProvider.KeyValue("auth.saml", "single_logout").MustBool(false) && hs.samlEnabled()
}

func (hs *HTTPServer) samlAutoLoginEnabled() bool {
	return hs.samlEnabled() && hs.SettingsProvider.KeyValue("auth.saml", "auto_login").MustBool(false)
}

func getLoginExternalError(err error) string {
	var createTokenErr *auth.CreateTokenErr
	if errors.As(err, &createTokenErr) {
		return createTokenErr.ExternalErr
	}

	gfErr := &errutil.Error{}
	if errors.As(err, gfErr) {
		return gfErr.Public().Message
	}

	return err.Error()
}

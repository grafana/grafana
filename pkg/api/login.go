package api

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	loginservice "github.com/grafana/grafana/pkg/services/login"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

const (
	viewIndex            = "index"
	loginErrorCookieName = "login_error"
)

var setIndexViewData = (*HTTPServer).setIndexViewData

var getViewIndex = func() string {
	return viewIndex
}

var (
	errAbsoluteRedirectTo  = errors.New("absolute URLs are not allowed for redirect_to cookie value")
	errInvalidRedirectTo   = errors.New("invalid redirect_to cookie value")
	errForbiddenRedirectTo = errors.New("forbidden redirect_to cookie value")
)

func (hs *HTTPServer) ValidateRedirectTo(redirectTo string) error {
	to, err := url.Parse(redirectTo)
	if err != nil {
		return errInvalidRedirectTo
	}

	if to.IsAbs() {
		return errAbsoluteRedirectTo
	}

	if to.Host != "" {
		return errForbiddenRedirectTo
	}

	// path should have exactly one leading slash
	if !strings.HasPrefix(to.Path, "/") {
		return errForbiddenRedirectTo
	}

	if strings.HasPrefix(to.Path, "//") {
		return errForbiddenRedirectTo
	}

	// when using a subUrl, the redirect_to should start with the subUrl (which contains the leading slash), otherwise the redirect
	// will send the user to the wrong location
	if hs.Cfg.AppSubURL != "" && !strings.HasPrefix(to.Path, hs.Cfg.AppSubURL+"/") {
		return errInvalidRedirectTo
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
	if errors.Is(c.LookupTokenErr, authn.ErrTokenNeedsRotation) {
		c.Redirect(hs.Cfg.AppSubURL + "/")
		return
	}

	viewData, err := setIndexViewData(hs, c)
	if err != nil {
		c.Handle(hs.Cfg, http.StatusInternalServerError, "Failed to get settings", err)
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

	// If user is not authenticated try auto-login
	if !c.IsSignedIn && hs.tryAutoLogin(c) {
		return
	}

	if c.IsSignedIn {
		// Assign login token to auth proxy users if enable_login_token = true
		// LDAP users authenticated by auth proxy are also assigned login token but their auth module is LDAP
		if hs.Cfg.AuthProxy.Enabled &&
			hs.Cfg.AuthProxy.EnableLoginToken &&
			c.SignedInUser.IsAuthenticatedBy(loginservice.AuthProxyAuthModule, loginservice.LDAPAuthModule) {
			user := &user.User{ID: c.SignedInUser.UserID, Email: c.SignedInUser.Email, Login: c.SignedInUser.Login}
			err := hs.loginUserWithUser(user, c)
			if err != nil {
				c.Handle(hs.Cfg, http.StatusInternalServerError, "Failed to sign in user", err)
				return
			}
		}

		if !c.UseSessionStorageRedirect {
			c.Redirect(hs.GetRedirectURL(c))
			return
		}

		c.Redirect(hs.Cfg.AppSubURL + "/")
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
			if hs.Features.IsEnabledGlobally(featuremgmt.FlagUseSessionStorageForRedirection) {
				redirectUrl += hs.getRedirectToForAutoLogin(c)
			}
			c.Logger.Info("OAuth auto login enabled. Redirecting to " + redirectUrl)
			c.Redirect(redirectUrl, 307)
			return true
		}
	}

	if samlAutoLogin {
		redirectUrl := hs.Cfg.AppSubURL + "/login/saml"
		if hs.Features.IsEnabledGlobally(featuremgmt.FlagUseSessionStorageForRedirection) {
			redirectUrl += hs.getRedirectToForAutoLogin(c)
		}
		c.Logger.Info("SAML auto login enabled. Redirecting to " + redirectUrl)
		c.Redirect(redirectUrl, 307)
		return true
	}

	return false
}

func (hs *HTTPServer) getRedirectToForAutoLogin(c *contextmodel.ReqContext) string {
	redirectTo := c.Req.FormValue("redirectTo")
	if hs.Cfg.AppSubURL != "" && strings.HasPrefix(redirectTo, hs.Cfg.AppSubURL) {
		redirectTo = strings.TrimPrefix(redirectTo, hs.Cfg.AppSubURL)
	}

	if redirectTo == "/" {
		return ""
	}

	// remove any forceLogin=true params
	redirectTo = middleware.RemoveForceLoginParams(redirectTo)
	return "?redirectTo=" + url.QueryEscape(redirectTo)
}

func (hs *HTTPServer) LoginAPIPing(c *contextmodel.ReqContext) response.Response {
	if c.IsSignedIn || c.IsAnonymous {
		return response.JSON(http.StatusOK, util.DynMap{"message": "Logged in"})
	}

	return response.Error(http.StatusUnauthorized, "Unauthorized", nil)
}

func (hs *HTTPServer) LoginPost(c *contextmodel.ReqContext) response.Response {
	identity, err := hs.authnService.Login(c.Req.Context(), authn.ClientForm, &authn.Request{HTTPRequest: c.Req})
	if err != nil {
		tokenErr := &auth.CreateTokenErr{}
		if errors.As(err, &tokenErr) {
			return response.Error(tokenErr.StatusCode, tokenErr.ExternalErr, tokenErr.InternalErr)
		}
		return response.Err(err)
	}

	metrics.MApiLoginPost.Inc()
	return authn.HandleLoginResponse(c.Req, c.Resp, hs.Cfg, identity, hs.ValidateRedirectTo, hs.Features)
}

func (hs *HTTPServer) LoginPasswordless(c *contextmodel.ReqContext) response.Response {
	identity, err := hs.authnService.Login(c.Req.Context(), authn.ClientPasswordless, &authn.Request{HTTPRequest: c.Req})
	if err != nil {
		tokenErr := &auth.CreateTokenErr{}
		if errors.As(err, &tokenErr) {
			return response.Error(tokenErr.StatusCode, tokenErr.ExternalErr, tokenErr.InternalErr)
		}
		return response.Err(err)
	}
	return authn.HandleLoginResponse(c.Req, c.Resp, hs.Cfg, identity, hs.ValidateRedirectTo, hs.Features)
}

func (hs *HTTPServer) StartPasswordless(c *contextmodel.ReqContext) {
	redirect, err := hs.authnService.RedirectURL(c.Req.Context(), authn.ClientPasswordless, &authn.Request{HTTPRequest: c.Req})
	if err != nil {
		c.Redirect(hs.redirectURLWithErrorCookie(c, err))
	}
	c.JSON(http.StatusOK, redirect)
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
	userToken, err := hs.AuthTokenService.CreateToken(ctx, &auth.CreateTokenCommand{User: user, ClientIP: ip, UserAgent: c.Req.UserAgent()})
	if err != nil {
		return fmt.Errorf("%v: %w", "failed to create auth token", err)
	}
	c.UserToken = userToken

	hs.log.Info("Successful Login", "User", user.Email)
	authn.WriteSessionCookie(c.Resp, hs.Cfg, userToken)
	return nil
}

func (hs *HTTPServer) Logout(c *contextmodel.ReqContext) {
	// FIXME: restructure saml client to implement authn.LogoutClient
	if hs.samlSingleLogoutEnabled() {
		if c.SignedInUser.GetAuthenticatedBy() == loginservice.SAMLAuthModule {
			c.Redirect(hs.Cfg.AppSubURL + "/logout/saml")
			return
		}
	}

	redirect, err := hs.authnService.Logout(c.Req.Context(), c.SignedInUser, c.UserToken)
	authn.DeleteSessionCookie(c.Resp, hs.Cfg)

	if err != nil {
		hs.log.Error("Failed perform proper logout", "error", err)
		c.Redirect(hs.Cfg.AppSubURL + "/login")
		return
	}

	hs.log.Info("Successful Logout", "id", c.SignedInUser.GetID())
	c.Redirect(redirect.URL)
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

	cookies.WriteCookie(ctx.Resp, cookieName, hex.EncodeToString(encryptedError), maxAge, hs.CookieOptionsFromCfg)

	return nil
}

func (hs *HTTPServer) redirectWithError(c *contextmodel.ReqContext, err error, v ...any) {
	c.Logger.Warn(err.Error(), v...)
	c.Redirect(hs.redirectURLWithErrorCookie(c, err))
}

func (hs *HTTPServer) RedirectResponseWithError(c *contextmodel.ReqContext, err error, v ...any) *response.RedirectResponse {
	c.Logger.Error(err.Error(), v...)
	location := hs.redirectURLWithErrorCookie(c, err)
	return response.Redirect(location)
}

func (hs *HTTPServer) redirectURLWithErrorCookie(c *contextmodel.ReqContext, err error) string {
	setCookie := true
	if hs.Features.IsEnabled(c.Req.Context(), featuremgmt.FlagIndividualCookiePreferences) {
		var userID int64
		if c.SignedInUser != nil && !c.SignedInUser.IsNil() {
			var errID error
			userID, errID = identity.UserIdentifier(c.SignedInUser.GetID())
			if errID != nil {
				hs.log.Error("failed to retrieve user ID", "error", errID)
			}
		}

		prefsQuery := pref.GetPreferenceWithDefaultsQuery{UserID: userID, OrgID: c.SignedInUser.GetOrgID(), Teams: c.Teams}
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
	return hs.authnService.IsClientEnabled(authn.ClientSAML)
}

func (hs *HTTPServer) samlName() string {
	config, ok := hs.authnService.GetClientConfig(authn.ClientSAML)
	if !ok {
		return ""
	}
	return config.GetDisplayName()
}

func (hs *HTTPServer) samlSingleLogoutEnabled() bool {
	config, ok := hs.authnService.GetClientConfig(authn.ClientSAML)
	if !ok {
		return false
	}
	return hs.samlEnabled() && config.IsSingleLogoutEnabled()
}

func (hs *HTTPServer) samlAutoLoginEnabled() bool {
	config, ok := hs.authnService.GetClientConfig(authn.ClientSAML)
	if !ok {
		return false
	}
	return hs.samlEnabled() && config.IsAutoLoginEnabled()
}

func getLoginExternalError(err error) string {
	var createTokenErr *auth.CreateTokenErr
	if errors.As(err, &createTokenErr) {
		return createTokenErr.ExternalErr
	}

	// unwrap until we get to the error message
	gfErr := &errutil.Error{}
	if errors.As(err, gfErr) {
		return getFirstPublicErrorMessage(gfErr)
	}

	return err.Error()
}

// Get the first public error message from an error chain.
func getFirstPublicErrorMessage(err *errutil.Error) string {
	errPublic := err.Public()
	if err.PublicMessage != "" {
		return errPublic.Message
	}

	underlyingErr := &errutil.Error{}
	if err.Underlying != nil && errors.As(err.Underlying, underlyingErr) {
		return getFirstPublicErrorMessage(underlyingErr)
	}

	return errPublic.Message
}

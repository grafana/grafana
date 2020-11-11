package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	oauthLogger          = log.New("oauth")
	OauthStateCookieName = "oauth_state"
)

func GenStateString() (string, error) {
	rnd := make([]byte, 32)
	if _, err := rand.Read(rnd); err != nil {
		oauthLogger.Error("failed to generate state string", "err", err)
		return "", err
	}
	return base64.URLEncoding.EncodeToString(rnd), nil
}

func (hs *HTTPServer) OAuthLogin(ctx *models.ReqContext) {
	loginInfo := models.LoginInfo{
		AuthModule: "oauth",
	}
	if setting.OAuthService == nil {
		hs.handleOAuthLoginError(ctx, loginInfo, LoginError{
			HttpStatus:    http.StatusNotFound,
			PublicMessage: "OAuth not enabled",
		})
		return
	}

	name := ctx.Params(":name")
	loginInfo.AuthModule = name
	connect, ok := social.SocialMap[name]
	if !ok {
		hs.handleOAuthLoginError(ctx, loginInfo, LoginError{
			HttpStatus:    http.StatusNotFound,
			PublicMessage: fmt.Sprintf("No OAuth with name %s configured", name),
		})
		return
	}

	errorParam := ctx.Query("error")
	if errorParam != "" {
		errorDesc := ctx.Query("error_description")
		oauthLogger.Error("failed to login ", "error", errorParam, "errorDesc", errorDesc)
		hs.handleOAuthLoginErrorWithRedirect(ctx, loginInfo, login.ErrProviderDeniedRequest, "error", errorParam, "errorDesc", errorDesc)
		return
	}

	code := ctx.Query("code")
	if code == "" {
		state, err := GenStateString()
		if err != nil {
			ctx.Logger.Error("Generating state string failed", "err", err)
			hs.handleOAuthLoginError(ctx, loginInfo, LoginError{
				HttpStatus:    http.StatusInternalServerError,
				PublicMessage: "An internal error occurred",
			})
			return
		}

		hashedState := hashStatecode(state, setting.OAuthService.OAuthInfos[name].ClientSecret)
		middleware.WriteCookie(ctx.Resp, OauthStateCookieName, hashedState, hs.Cfg.OAuthCookieMaxAge, hs.CookieOptionsFromCfg)
		if setting.OAuthService.OAuthInfos[name].HostedDomain == "" {
			ctx.Redirect(connect.AuthCodeURL(state, oauth2.AccessTypeOnline))
		} else {
			ctx.Redirect(connect.AuthCodeURL(state, oauth2.SetAuthURLParam("hd", setting.OAuthService.OAuthInfos[name].HostedDomain), oauth2.AccessTypeOnline))
		}
		return
	}

	cookieState := ctx.GetCookie(OauthStateCookieName)

	// delete cookie
	middleware.DeleteCookie(ctx.Resp, OauthStateCookieName, hs.CookieOptionsFromCfg)

	if cookieState == "" {
		hs.handleOAuthLoginError(ctx, loginInfo, LoginError{
			HttpStatus:    http.StatusInternalServerError,
			PublicMessage: "login.OAuthLogin(missing saved state)",
		})
		return
	}

	queryState := hashStatecode(ctx.Query("state"), setting.OAuthService.OAuthInfos[name].ClientSecret)
	oauthLogger.Info("state check", "queryState", queryState, "cookieState", cookieState)
	if cookieState != queryState {
		hs.handleOAuthLoginError(ctx, loginInfo, LoginError{
			HttpStatus:    http.StatusInternalServerError,
			PublicMessage: "login.OAuthLogin(state mismatch)",
		})
		return
	}

	oauthClient, err := social.GetOAuthHttpClient(name)
	if err != nil {
		ctx.Logger.Error("Failed to create OAuth http client", "error", err)
		hs.handleOAuthLoginError(ctx, loginInfo, LoginError{
			HttpStatus:    http.StatusInternalServerError,
			PublicMessage: "login.OAuthLogin(" + err.Error() + ")",
		})
		return
	}

	oauthCtx := context.WithValue(context.Background(), oauth2.HTTPClient, oauthClient)

	// get token from provider
	token, err := connect.Exchange(oauthCtx, code)
	if err != nil {
		hs.handleOAuthLoginError(ctx, loginInfo, LoginError{
			HttpStatus:    http.StatusInternalServerError,
			PublicMessage: "login.OAuthLogin(NewTransportWithCode)",
			Err:           err,
		})
		return
	}
	// token.TokenType was defaulting to "bearer", which is out of spec, so we explicitly set to "Bearer"
	token.TokenType = "Bearer"

	oauthLogger.Debug("OAuthLogin Got token", "token", token)

	// set up oauth2 client
	client := connect.Client(oauthCtx, token)

	// get user info
	userInfo, err := connect.UserInfo(client, token)
	if err != nil {
		if sErr, ok := err.(*social.Error); ok {
			hs.handleOAuthLoginErrorWithRedirect(ctx, loginInfo, sErr)
		} else {
			hs.handleOAuthLoginError(ctx, loginInfo, LoginError{
				HttpStatus:    http.StatusInternalServerError,
				PublicMessage: fmt.Sprintf("login.OAuthLogin(get info from %s)", name),
				Err:           err,
			})
		}
		return
	}

	oauthLogger.Debug("OAuthLogin got user info", "userInfo", userInfo)

	// validate that we got at least an email address
	if userInfo.Email == "" {
		hs.handleOAuthLoginErrorWithRedirect(ctx, loginInfo, login.ErrNoEmail)
		return
	}

	// validate that the email is allowed to login to grafana
	if !connect.IsEmailAllowed(userInfo.Email) {
		hs.handleOAuthLoginErrorWithRedirect(ctx, loginInfo, login.ErrEmailNotAllowed)
		return
	}

	loginInfo.ExternalUser = *buildExternalUserInfo(token, userInfo, name)
	loginInfo.User, err = syncUser(ctx, &loginInfo.ExternalUser, connect)
	if err != nil {
		hs.handleOAuthLoginErrorWithRedirect(ctx, loginInfo, err)
		return
	}

	// login
	if err := hs.loginUserWithUser(loginInfo.User, ctx); err != nil {
		hs.handleOAuthLoginErrorWithRedirect(ctx, loginInfo, err)
		return
	}

	loginInfo.HTTPStatus = http.StatusOK
	hs.HooksService.RunLoginHook(&loginInfo, ctx)
	metrics.MApiLoginOAuth.Inc()

	if redirectTo, err := url.QueryUnescape(ctx.GetCookie("redirect_to")); err == nil && len(redirectTo) > 0 {
		if err := hs.ValidateRedirectTo(redirectTo); err == nil {
			middleware.DeleteCookie(ctx.Resp, "redirect_to", hs.CookieOptionsFromCfg)
			ctx.Redirect(redirectTo)
			return
		}
		log.Debugf("Ignored invalid redirect_to cookie value: %v", redirectTo)
	}

	ctx.Redirect(setting.AppSubUrl + "/")
}

// buildExternalUserInfo returns a ExternalUserInfo struct from OAuth user profile
func buildExternalUserInfo(token *oauth2.Token, userInfo *social.BasicUserInfo, name string) *models.ExternalUserInfo {
	oauthLogger.Debug("Building external user info from OAuth user info")

	extUser := &models.ExternalUserInfo{
		AuthModule: fmt.Sprintf("oauth_%s", name),
		OAuthToken: token,
		AuthId:     userInfo.Id,
		Name:       userInfo.Name,
		Login:      userInfo.Login,
		Email:      userInfo.Email,
		OrgRoles:   map[int64]models.RoleType{},
		Groups:     userInfo.Groups,
	}

	if userInfo.Role != "" {
		rt := models.RoleType(userInfo.Role)
		if rt.IsValid() {
			// The user will be assigned a role in either the auto-assigned organization or in the default one
			var orgID int64
			if setting.AutoAssignOrg && setting.AutoAssignOrgId > 0 {
				orgID = int64(setting.AutoAssignOrgId)
				logger.Debug("The user has a role assignment and organization membership is auto-assigned",
					"role", userInfo.Role, "orgId", orgID)
			} else {
				orgID = int64(1)
				logger.Debug("The user has a role assignment and organization membership is not auto-assigned",
					"role", userInfo.Role, "orgId", orgID)
			}
			extUser.OrgRoles[orgID] = rt
		}
	}

	return extUser
}

// syncUser syncs a Grafana user profile with the corresponding OAuth profile.
func syncUser(
	ctx *models.ReqContext,
	extUser *models.ExternalUserInfo,
	connect social.SocialConnector,
) (*models.User, error) {
	oauthLogger.Debug("Syncing Grafana user with corresponding OAuth profile")
	// add/update user in Grafana
	cmd := &models.UpsertUserCommand{
		ReqContext:    ctx,
		ExternalUser:  extUser,
		SignupAllowed: connect.IsSignupAllowed(),
	}
	if err := bus.Dispatch(cmd); err != nil {
		return nil, err
	}

	// Do not expose disabled status,
	// just show incorrect user credentials error (see #17947)
	if cmd.Result.IsDisabled {
		oauthLogger.Warn("User is disabled", "user", cmd.Result.Login)
		return nil, login.ErrInvalidCredentials
	}

	return cmd.Result, nil
}

func hashStatecode(code, seed string) string {
	hashBytes := sha256.Sum256([]byte(code + setting.SecretKey + seed))
	return hex.EncodeToString(hashBytes[:])
}

type LoginError struct {
	HttpStatus    int
	PublicMessage string
	Err           error
}

func (hs *HTTPServer) handleOAuthLoginError(ctx *models.ReqContext, info models.LoginInfo, err LoginError) {
	ctx.Handle(err.HttpStatus, err.PublicMessage, err.Err)

	info.Error = err.Err
	if info.Error == nil {
		info.Error = errors.New(err.PublicMessage)
	}
	info.HTTPStatus = err.HttpStatus

	hs.HooksService.RunLoginHook(&info, ctx)
}

func (hs *HTTPServer) handleOAuthLoginErrorWithRedirect(ctx *models.ReqContext, info models.LoginInfo, err error, v ...interface{}) {
	hs.redirectWithError(ctx, err, v...)

	info.Error = err
	hs.HooksService.RunLoginHook(&info, ctx)
}

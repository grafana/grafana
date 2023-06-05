package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/services/authn"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	loginservice "github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

var (
	oauthLogger = log.New("oauth")
)

const (
	OauthStateCookieName = "oauth_state"
	OauthPKCECookieName  = "oauth_code_verifier"
)

func GenStateString() (string, error) {
	rnd := make([]byte, 32)
	if _, err := rand.Read(rnd); err != nil {
		oauthLogger.Error("failed to generate state string", "err", err)
		return "", err
	}
	return base64.URLEncoding.EncodeToString(rnd), nil
}

func (hs *HTTPServer) OAuthLogin(ctx *contextmodel.ReqContext) {
	name := web.Params(ctx.Req)[":name"]
	loginInfo := loginservice.LoginInfo{AuthModule: name}

	if errorParam := ctx.Query("error"); errorParam != "" {
		errorDesc := ctx.Query("error_description")
		oauthLogger.Error("failed to login ", "error", errorParam, "errorDesc", errorDesc)
		hs.handleOAuthLoginErrorWithRedirect(ctx, loginInfo, login.ErrProviderDeniedRequest, "error", errorParam, "errorDesc", errorDesc)
		return
	}

	code := ctx.Query("code")

	req := &authn.Request{HTTPRequest: ctx.Req, Resp: ctx.Resp}
	if code == "" {
		redirect, err := hs.authnService.RedirectURL(ctx.Req.Context(), authn.ClientWithPrefix(name), req)
		if err != nil {
			ctx.Redirect(hs.redirectURLWithErrorCookie(ctx, err))
			return
		}

		if pkce := redirect.Extra[authn.KeyOAuthPKCE]; pkce != "" {
			cookies.WriteCookie(ctx.Resp, OauthPKCECookieName, pkce, hs.Cfg.OAuthCookieMaxAge, hs.CookieOptionsFromCfg)
		}

		cookies.WriteCookie(ctx.Resp, OauthStateCookieName, redirect.Extra[authn.KeyOAuthState], hs.Cfg.OAuthCookieMaxAge, hs.CookieOptionsFromCfg)
		ctx.Redirect(redirect.URL)
		return
	}

	identity, err := hs.authnService.Login(ctx.Req.Context(), authn.ClientWithPrefix(name), req)
	// NOTE: always delete these cookies, even if login failed
	cookies.DeleteCookie(ctx.Resp, OauthPKCECookieName, hs.CookieOptionsFromCfg)
	cookies.DeleteCookie(ctx.Resp, OauthStateCookieName, hs.CookieOptionsFromCfg)

	if err != nil {
		ctx.Redirect(hs.redirectURLWithErrorCookie(ctx, err))
		return
	}

	metrics.MApiLoginOAuth.Inc()
	authn.HandleLoginRedirect(ctx.Req, ctx.Resp, hs.Cfg, identity, hs.ValidateRedirectTo)
	return
}

// buildExternalUserInfo returns a ExternalUserInfo struct from OAuth user profile
func (hs *HTTPServer) buildExternalUserInfo(token *oauth2.Token, userInfo *social.BasicUserInfo, name string) *loginservice.ExternalUserInfo {
	oauthLogger.Debug("Building external user info from OAuth user info")

	extUser := &loginservice.ExternalUserInfo{
		AuthModule:     fmt.Sprintf("oauth_%s", name),
		OAuthToken:     token,
		AuthId:         userInfo.Id,
		Name:           userInfo.Name,
		Login:          userInfo.Login,
		Email:          userInfo.Email,
		OrgRoles:       map[int64]org.RoleType{},
		Groups:         userInfo.Groups,
		IsGrafanaAdmin: userInfo.IsGrafanaAdmin,
	}

	if userInfo.Role != "" && !hs.Cfg.OAuthSkipOrgRoleUpdateSync {
		rt := userInfo.Role
		if rt.IsValid() {
			// The user will be assigned a role in either the auto-assigned organization or in the default one
			var orgID int64
			if hs.Cfg.AutoAssignOrg && hs.Cfg.AutoAssignOrgId > 0 {
				orgID = int64(hs.Cfg.AutoAssignOrgId)
				plog.Debug("The user has a role assignment and organization membership is auto-assigned",
					"role", userInfo.Role, "orgId", orgID)
			} else {
				orgID = int64(1)
				plog.Debug("The user has a role assignment and organization membership is not auto-assigned",
					"role", userInfo.Role, "orgId", orgID)
			}
			extUser.OrgRoles[orgID] = rt
		}
	}

	return extUser
}

// SyncUser syncs a Grafana user profile with the corresponding OAuth profile.
func (hs *HTTPServer) SyncUser(
	ctx *contextmodel.ReqContext,
	extUser *loginservice.ExternalUserInfo,
	connect social.SocialConnector,
) (*user.User, error) {
	oauthLogger.Debug("Syncing Grafana user with corresponding OAuth profile")
	// add/update user in Grafana
	cmd := &loginservice.UpsertUserCommand{
		ReqContext:    ctx,
		ExternalUser:  extUser,
		SignupAllowed: connect.IsSignupAllowed(),
		UserLookupParams: loginservice.UserLookupParams{
			Email:  &extUser.Email,
			UserID: nil,
			Login:  nil,
		},
	}

	upsertedUser, err := hs.Login.UpsertUser(ctx.Req.Context(), cmd)
	if err != nil {
		return nil, err
	}

	// Do not expose disabled status,
	// just show incorrect user credentials error (see #17947)
	if upsertedUser.IsDisabled {
		oauthLogger.Warn("User is disabled", "user", upsertedUser.Login)
		return nil, login.ErrInvalidCredentials
	}

	return upsertedUser, nil
}

func (hs *HTTPServer) hashStatecode(code, seed string) string {
	hashBytes := sha256.Sum256([]byte(code + hs.Cfg.SecretKey + seed))
	return hex.EncodeToString(hashBytes[:])
}

type LoginError struct {
	HttpStatus    int
	PublicMessage string
	Err           error
}

func (hs *HTTPServer) handleOAuthLoginError(ctx *contextmodel.ReqContext, info loginservice.LoginInfo, err LoginError) {
	ctx.Handle(hs.Cfg, err.HttpStatus, err.PublicMessage, err.Err)
}

func (hs *HTTPServer) handleOAuthLoginErrorWithRedirect(ctx *contextmodel.ReqContext, info loginservice.LoginInfo, err error, v ...interface{}) {
	hs.redirectWithError(ctx, err, v...)
}

package api

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/session"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/social"
)

var oauthLogger = log.New("oauth")

func GenStateString() string {
	rnd := make([]byte, 32)
	rand.Read(rnd)
	return base64.URLEncoding.EncodeToString(rnd)
}

func OAuthLogin(ctx *m.ReqContext) {
	if setting.OAuthService == nil {
		ctx.Handle(404, "OAuth not enabled", nil)
		return
	}

	name := ctx.Params(":name")
	connect, ok := social.SocialMap[name]
	if !ok {
		ctx.Handle(404, fmt.Sprintf("No OAuth with name %s configured", name), nil)
		return
	}

	errorParam := ctx.Query("error")
	if errorParam != "" {
		errorDesc := ctx.Query("error_description")
		oauthLogger.Error("failed to login ", "error", errorParam, "errorDesc", errorDesc)
		redirectWithError(ctx, login.ErrProviderDeniedRequest, "error", errorParam, "errorDesc", errorDesc)
		return
	}

	code := ctx.Query("code")
	if code == "" {
		state := GenStateString()
		ctx.Session.Set(session.SESS_KEY_OAUTH_STATE, state)
		if setting.OAuthService.OAuthInfos[name].HostedDomain == "" {
			ctx.Redirect(connect.AuthCodeURL(state, oauth2.AccessTypeOnline))
		} else {
			ctx.Redirect(connect.AuthCodeURL(state, oauth2.SetAuthURLParam("hd", setting.OAuthService.OAuthInfos[name].HostedDomain), oauth2.AccessTypeOnline))
		}
		return
	}

	savedState, ok := ctx.Session.Get(session.SESS_KEY_OAUTH_STATE).(string)
	if !ok {
		ctx.Handle(500, "login.OAuthLogin(missing saved state)", nil)
		return
	}

	queryState := ctx.Query("state")
	if savedState != queryState {
		ctx.Handle(500, "login.OAuthLogin(state mismatch)", nil)
		return
	}

	// handle call back
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: setting.OAuthService.OAuthInfos[name].TlsSkipVerify,
		},
	}
	oauthClient := &http.Client{
		Transport: tr,
	}

	if setting.OAuthService.OAuthInfos[name].TlsClientCert != "" || setting.OAuthService.OAuthInfos[name].TlsClientKey != "" {
		cert, err := tls.LoadX509KeyPair(setting.OAuthService.OAuthInfos[name].TlsClientCert, setting.OAuthService.OAuthInfos[name].TlsClientKey)
		if err != nil {
			ctx.Logger.Error("Failed to setup TlsClientCert", "oauth", name, "error", err)
			ctx.Handle(500, "login.OAuthLogin(Failed to setup TlsClientCert)", nil)
			return
		}

		tr.TLSClientConfig.Certificates = append(tr.TLSClientConfig.Certificates, cert)
	}

	if setting.OAuthService.OAuthInfos[name].TlsClientCa != "" {
		caCert, err := ioutil.ReadFile(setting.OAuthService.OAuthInfos[name].TlsClientCa)
		if err != nil {
			ctx.Logger.Error("Failed to setup TlsClientCa", "oauth", name, "error", err)
			ctx.Handle(500, "login.OAuthLogin(Failed to setup TlsClientCa)", nil)
			return
		}
		caCertPool := x509.NewCertPool()
		caCertPool.AppendCertsFromPEM(caCert)

		tr.TLSClientConfig.RootCAs = caCertPool
	}

	oauthCtx := context.WithValue(context.Background(), oauth2.HTTPClient, oauthClient)

	// get token from provider
	token, err := connect.Exchange(oauthCtx, code)
	if err != nil {
		ctx.Handle(500, "login.OAuthLogin(NewTransportWithCode)", err)
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
			redirectWithError(ctx, sErr)
		} else {
			ctx.Handle(500, fmt.Sprintf("login.OAuthLogin(get info from %s)", name), err)
		}
		return
	}

	oauthLogger.Debug("OAuthLogin got user info", "userInfo", userInfo)

	// validate that we got at least an email address
	if userInfo.Email == "" {
		redirectWithError(ctx, login.ErrNoEmail)
		return
	}

	// validate that the email is allowed to login to grafana
	if !connect.IsEmailAllowed(userInfo.Email) {
		redirectWithError(ctx, login.ErrEmailNotAllowed)
		return
	}

	extUser := &m.ExternalUserInfo{
		AuthModule: "oauth_" + name,
		AuthId:     userInfo.Id,
		Name:       userInfo.Name,
		Login:      userInfo.Login,
		Email:      userInfo.Email,
		OrgRoles:   map[int64]m.RoleType{},
	}

	if userInfo.Role != "" {
		extUser.OrgRoles[1] = m.RoleType(userInfo.Role)
	}

	// add/update user in grafana
	cmd := &m.UpsertUserCommand{
		ReqContext:    ctx,
		ExternalUser:  extUser,
		SignupAllowed: connect.IsSignupAllowed(),
	}
	err = bus.Dispatch(cmd)
	if err != nil {
		redirectWithError(ctx, err)
		return
	}

	// login
	loginUserWithUser(cmd.Result, ctx)

	metrics.M_Api_Login_OAuth.Inc()

	if redirectTo, _ := url.QueryUnescape(ctx.GetCookie("redirect_to")); len(redirectTo) > 0 {
		ctx.SetCookie("redirect_to", "", -1, setting.AppSubUrl+"/")
		ctx.Redirect(redirectTo)
		return
	}

	ctx.Redirect(setting.AppSubUrl + "/")
}

func redirectWithError(ctx *m.ReqContext, err error, v ...interface{}) {
	ctx.Logger.Error(err.Error(), v...)
	ctx.Session.Set("loginError", err.Error())
	ctx.Redirect(setting.AppSubUrl + "/login")
}

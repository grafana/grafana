package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"fmt"
 "strconv"
	"io/ioutil"
	"net/http"
	"net/url"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/login/social"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	oauthLogger          = log.New("oauth")
	OauthStateCookieName = "oauth_state"
)

func GenStateString() string {
	rnd := make([]byte, 32)
	rand.Read(rnd)
	return base64.URLEncoding.EncodeToString(rnd)
}

var OrgIdMap map[int64]m.RoleType
var OrganizationMembership int = 0
	func GetOrgByNameQuery(orgName string,email string)(){
	 OrgIdMap = make(map[int64]m.RoleType)
	 listOrgs := &m.GetOrgByNameQuery {Name: orgName}
	 if err := bus.Dispatch(listOrgs); err != nil {
	 log.Debug("This organization does not exist in grafana "+orgName)
	 }else{
    log.Debug("This organization in grafana "+orgName)
    OrganizationMembership = OrganizationMembership+1
	   //Set default permissions,The organization is created by the administrator of grafana, others can only join
	   //OrgIdMap[listOrgs.Result.Id] = m.ROLE_VIEWER
    //OrgIdMap[listOrgs.Result.Id] = ""
    //OrgIdMap[listOrgs.Result.Id] = m.ROLE_ADMIN
    //m.GetExternalUserInfoByLoginQuery{LoginOrEmail:"ying.lv2@hp.com",}
    userQuery := &m.GetExternalUserInfoByLoginQuery{
     //LoginOrEmail:     "ying.lv2@hp.com",
     LoginOrEmail:     email,

    }

    fmt.Println(userQuery)
    if err := bus.Dispatch(userQuery); err != nil {
     fmt.Println(err)
     OrgIdMap[listOrgs.Result.Id] = m.ROLE_VIEWER
     //OrgIdMap[listOrgs.Result.Id] = m.ROLE_EDITOR 
    }else{
     userInfo := userQuery.Result
     fmt.Println(userInfo)
     //fmt.Println(userInfo.OrgRoles)
     //fmt.Println(userInfo.Groups)
     //fmt.Println(userInfo.IsDisabled)
     //fmt.Println("IsGrafanaAdmin")
     //fmt.Println(userInfo.IsGrafanaAdmin)
    }
    /**
    userQueryitems := m.GetUserByLoginQuery{LoginOrEmail: email}
    err := bus.Dispatch(&userQueryitems)
    if err != nil {
     fmt.Println(err) 
    }else{
      fmt.Println("userQueryitems") 
      fmt.Println(userQueryitems) 
    }
    fmt.Println(userQuery.Result.UserId) 
    authInfoQuery := &m.GetAuthInfoQuery{UserId: userQuery.Result.UserId}
    if err := bus.Dispatch(authInfoQuery); err != nil {
     fmt.Println(err) 
    }
**/
	   for key, value := range OrgIdMap { fmt.Println("Key:", key, "Value:", value) }
	   log.Debug("The name of the organization is "+orgName)
	   log.Debug("The organization number is "+strconv.FormatInt(listOrgs.Result.Id,10))
    fmt.Println(OrgIdMap)
	 }
	
	}
func (hs *HTTPServer) OAuthLogin(ctx *m.ReqContext) {
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
		hs.redirectWithError(ctx, login.ErrProviderDeniedRequest, "error", errorParam, "errorDesc", errorDesc)
		return
	}

	code := ctx.Query("code")
	if code == "" {
		state := GenStateString()
		hashedState := hashStatecode(state, setting.OAuthService.OAuthInfos[name].ClientSecret)
		hs.writeCookie(ctx.Resp, OauthStateCookieName, hashedState, 60)
		if setting.OAuthService.OAuthInfos[name].HostedDomain == "" {
			ctx.Redirect(connect.AuthCodeURL(state, oauth2.AccessTypeOnline))
		} else {
			ctx.Redirect(connect.AuthCodeURL(state, oauth2.SetAuthURLParam("hd", setting.OAuthService.OAuthInfos[name].HostedDomain), oauth2.AccessTypeOnline))
		}
		return
	}

	cookieState := ctx.GetCookie(OauthStateCookieName)

	// delete cookie
	ctx.Resp.Header().Del("Set-Cookie")
	hs.deleteCookie(ctx.Resp, OauthStateCookieName)

	if cookieState == "" {
		ctx.Handle(500, "login.OAuthLogin(missing saved state)", nil)
		return
	}

	queryState := hashStatecode(ctx.Query("state"), setting.OAuthService.OAuthInfos[name].ClientSecret)
	oauthLogger.Info("state check", "queryState", queryState, "cookieState", cookieState)
	if cookieState != queryState {
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
			hs.redirectWithError(ctx, sErr)
		} else {
			ctx.Handle(500, fmt.Sprintf("login.OAuthLogin(get info from %s)", name), err)
		}
		return
	}

	oauthLogger.Debug("OAuthLogin got user info", "userInfo", userInfo)

	// validate that we got at least an email address
	if userInfo.Email == "" {
		hs.redirectWithError(ctx, login.ErrNoEmail)
		return
	}

	// validate that the email is allowed to login to grafana
	if !connect.IsEmailAllowed(userInfo.Email) {
		hs.redirectWithError(ctx, login.ErrEmailNotAllowed)
		return
	}


 //		OrgRoles:   OrgIdMap ,
	extUser := &m.ExternalUserInfo{
		AuthModule: "oauth_" + name,
		OAuthToken: token,
		AuthId:     userInfo.Id,
		Name:       userInfo.Name,
		Login:      userInfo.Login,
		Email:      userInfo.Email,
  Organizations:      userInfo.Organizations,
//		OrgRoles:   map[int64]m.RoleType{2: m.ROLE_VIEWER},
	}


 for _, value := range extUser.Organizations{
	   log.Debug("Loop printing user's Organizations is "+value)
	   GetOrgByNameQuery(value,userInfo.Email)
	 }
 extUser.OrgRoles = OrgIdMap
  
//	if userInfo.Role != "" {
//		extUser.OrgRoles[1] = m.RoleType(userInfo.Role)
//	}
 if  OrganizationMembership == 0 {

   hs.redirectWithError(ctx, login.ErrMissingOrganizationMembership)
   return
 }else{
   log.Debug("OrganizationMembership count is "+strconv.Itoa(OrganizationMembership))
   OrganizationMembership = 0
 }
	// add/update user in grafana
	cmd := &m.UpsertUserCommand{
		ReqContext:    ctx,
		ExternalUser:  extUser,
		SignupAllowed: connect.IsSignupAllowed(),
	}
//		SignupAllowed: true,
	err = bus.Dispatch(cmd)
	if err != nil {
		hs.redirectWithError(ctx, err)
		return
	}

	// login
	hs.loginUserWithUser(cmd.Result, ctx)

	metrics.M_Api_Login_OAuth.Inc()

	if redirectTo, _ := url.QueryUnescape(ctx.GetCookie("redirect_to")); len(redirectTo) > 0 {
		ctx.SetCookie("redirect_to", "", -1, setting.AppSubUrl+"/")
		ctx.Redirect(redirectTo)
		return
	}

	ctx.Redirect(setting.AppSubUrl + "/")
}

func (hs *HTTPServer) deleteCookie(w http.ResponseWriter, name string) {
	hs.writeCookie(w, name, "", -1)
}

func (hs *HTTPServer) writeCookie(w http.ResponseWriter, name string, value string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		MaxAge:   maxAge,
		Value:    value,
		HttpOnly: true,
		Path:     setting.AppSubUrl + "/",
		Secure:   hs.Cfg.CookieSecure,
		SameSite: hs.Cfg.CookieSameSite,
	})
}

func hashStatecode(code, seed string) string {
	hashBytes := sha256.Sum256([]byte(code + setting.SecretKey + seed))
	return hex.EncodeToString(hashBytes[:])
}

func (hs *HTTPServer) redirectWithError(ctx *m.ReqContext, err error, v ...interface{}) {
	ctx.Logger.Error(err.Error(), v...)
	hs.trySetEncryptedCookie(ctx, LoginErrorCookieName, err.Error(), 60)

	ctx.Redirect(setting.AppSubUrl + "/login")
}

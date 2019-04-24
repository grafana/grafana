package middleware

import (
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	macaron "gopkg.in/macaron.v1"
)

var (
	ReqGrafanaAdmin = Auth(&AuthOptions{ReqSignedIn: true, ReqGrafanaAdmin: true})
	ReqSignedIn     = Auth(&AuthOptions{ReqSignedIn: true})
	ReqEditorRole   = RoleAuth(m.ROLE_EDITOR, m.ROLE_ADMIN)
	ReqOrgAdmin     = RoleAuth(m.ROLE_ADMIN)
)

func GetContextHandler(ats m.UserTokenService, remoteCache *remotecache.RemoteCache) macaron.Handler {
	return func(c *macaron.Context) {
		ctx := &m.ReqContext{
			Context:        c,
			SignedInUser:   &m.SignedInUser{},
			IsSignedIn:     false,
			AllowAnonymous: false,
			SkipCache:      false,
			Logger:         log.New("context"),
		}

		orgId := int64(0)
		orgIdHeader := ctx.Req.Header.Get("X-Grafana-Org-Id")
		if orgIdHeader != "" {
			orgId, _ = strconv.ParseInt(orgIdHeader, 10, 64)
		}

		// the order in which these are tested are important
		// look for api key in Authorization header first
		// then init session and look for userId in session
		// then look for api key in session (special case for render calls via api)
		// then test if anonymous access is enabled
		switch {
		case initContextWithRenderAuth(ctx):
		case initContextWithApiKey(ctx):
		case initContextWithBasicAuth(ctx, orgId):
		case initContextWithAuthProxy(remoteCache, ctx, orgId):
		case initContextWithToken(ats, ctx, orgId):
		case initContextWithAnonymousUser(ctx):
		}

		ctx.Logger = log.New("context", "userId", ctx.UserId, "orgId", ctx.OrgId, "uname", ctx.Login)
		ctx.Data["ctx"] = ctx

		c.Map(ctx)

		// update last seen every 5min
		if ctx.ShouldUpdateLastSeenAt() {
			ctx.Logger.Debug("Updating last user_seen_at", "user_id", ctx.UserId)
			if err := bus.Dispatch(&m.UpdateUserLastSeenAtCommand{UserId: ctx.UserId}); err != nil {
				ctx.Logger.Error("Failed to update last_seen_at", "error", err)
			}
		}
	}
}

func initContextWithAnonymousUser(ctx *m.ReqContext) bool {
	if !setting.AnonymousEnabled {
		return false
	}

	orgQuery := m.GetOrgByNameQuery{Name: setting.AnonymousOrgName}
	if err := bus.Dispatch(&orgQuery); err != nil {
		log.Error(3, "Anonymous access organization error: '%s': %s", setting.AnonymousOrgName, err)
		return false
	}

	ctx.IsSignedIn = false
	ctx.AllowAnonymous = true
	ctx.SignedInUser = &m.SignedInUser{IsAnonymous: true}
	ctx.OrgRole = m.RoleType(setting.AnonymousOrgRole)
	ctx.OrgId = orgQuery.Result.Id
	ctx.OrgName = orgQuery.Result.Name
	return true
}

func initContextWithApiKey(ctx *m.ReqContext) bool {
	var keyString string
	if keyString = getApiKey(ctx); keyString == "" {
		return false
	}

	// base64 decode key
	decoded, err := apikeygen.Decode(keyString)
	if err != nil {
		ctx.JsonApiErr(401, "Invalid API key", err)
		return true
	}

	// fetch key
	keyQuery := m.GetApiKeyByNameQuery{KeyName: decoded.Name, OrgId: decoded.OrgId}
	if err := bus.Dispatch(&keyQuery); err != nil {
		ctx.JsonApiErr(401, "Invalid API key", err)
		return true
	}

	apikey := keyQuery.Result

	// validate api key
	if !apikeygen.IsValid(decoded, apikey.Key) {
		ctx.JsonApiErr(401, "Invalid API key", err)
		return true
	}

	ctx.IsSignedIn = true
	ctx.SignedInUser = &m.SignedInUser{}
	ctx.OrgRole = apikey.Role
	ctx.ApiKeyId = apikey.Id
	ctx.OrgId = apikey.OrgId
	return true
}

func initContextWithBasicAuth(ctx *m.ReqContext, orgId int64) bool {

	if !setting.BasicAuthEnabled {
		return false
	}

	header := ctx.Req.Header.Get("Authorization")
	if header == "" {
		return false
	}

	username, password, err := util.DecodeBasicAuthHeader(header)
	if err != nil {
		ctx.JsonApiErr(401, "Invalid Basic Auth Header", err)
		return true
	}

	loginQuery := m.GetUserByLoginQuery{LoginOrEmail: username}
	if err := bus.Dispatch(&loginQuery); err != nil {
		ctx.JsonApiErr(401, "Basic auth failed", err)
		return true
	}

	user := loginQuery.Result

	loginUserQuery := m.LoginUserQuery{Username: username, Password: password, User: user}
	if err := bus.Dispatch(&loginUserQuery); err != nil {
		ctx.JsonApiErr(401, "Invalid username or password", err)
		return true
	}

	query := m.GetSignedInUserQuery{UserId: user.Id, OrgId: orgId}
	if err := bus.Dispatch(&query); err != nil {
		ctx.JsonApiErr(401, "Authentication error", err)
		return true
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	return true
}

func initContextWithToken(authTokenService m.UserTokenService, ctx *m.ReqContext, orgID int64) bool {
	rawToken := ctx.GetCookie(setting.LoginCookieName)
	if rawToken == "" {
		return false
	}

	token, err := authTokenService.LookupToken(rawToken)
	if err != nil {
		ctx.Logger.Error("failed to look up user based on cookie", "error", err)
		WriteSessionCookie(ctx, "", -1)
		return false
	}

	query := m.GetSignedInUserQuery{UserId: token.UserId, OrgId: orgID}
	if err := bus.Dispatch(&query); err != nil {
		ctx.Logger.Error("failed to get user with id", "userId", token.UserId, "error", err)
		return false
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	ctx.UserToken = token

	rotated, err := authTokenService.TryRotateToken(token, ctx.RemoteAddr(), ctx.Req.UserAgent())
	if err != nil {
		ctx.Logger.Error("failed to rotate token", "error", err)
		return true
	}

	if rotated {
		WriteSessionCookie(ctx, token.UnhashedToken, setting.LoginMaxLifetimeDays)
	}

	return true
}

func WriteSessionCookie(ctx *m.ReqContext, value string, maxLifetimeDays int) {
	if setting.Env == setting.DEV {
		ctx.Logger.Info("new token", "unhashed token", value)
	}

	var maxAge int
	if maxLifetimeDays <= 0 {
		maxAge = -1
	} else {
		maxAgeHours := (time.Duration(setting.LoginMaxLifetimeDays) * 24 * time.Hour) + time.Hour
		maxAge = int(maxAgeHours.Seconds())
	}

	ctx.Resp.Header().Del("Set-Cookie")
	cookie := http.Cookie{
		Name:     setting.LoginCookieName,
		Value:    url.QueryEscape(value),
		HttpOnly: true,
		Path:     setting.AppSubUrl + "/",
		Secure:   setting.CookieSecure,
		MaxAge:   maxAge,
		SameSite: setting.CookieSameSite,
	}

	http.SetCookie(ctx.Resp, &cookie)
}

func AddDefaultResponseHeaders() macaron.Handler {
	return func(ctx *m.ReqContext) {
		if ctx.IsApiRequest() && ctx.Req.Method == "GET" {
			ctx.Resp.Header().Add("Cache-Control", "no-cache")
			ctx.Resp.Header().Add("Pragma", "no-cache")
			ctx.Resp.Header().Add("Expires", "-1")
		}
	}
}

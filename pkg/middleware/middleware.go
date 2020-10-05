package middleware

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	macaron "gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var getTime = time.Now

const (
	errStringInvalidUsernamePassword = "Invalid username or password"
	errStringInvalidAPIKey           = "Invalid API key"
)

var (
	ReqGrafanaAdmin = Auth(&AuthOptions{
		ReqSignedIn:     true,
		ReqGrafanaAdmin: true,
	})
	ReqSignedIn   = Auth(&AuthOptions{ReqSignedIn: true})
	ReqEditorRole = RoleAuth(models.ROLE_EDITOR, models.ROLE_ADMIN)
	ReqOrgAdmin   = RoleAuth(models.ROLE_ADMIN)
)

func GetContextHandler(
	ats models.UserTokenService,
	remoteCache *remotecache.RemoteCache,
	renderService rendering.Service,
) macaron.Handler {
	return func(c *macaron.Context) {
		ctx := &models.ReqContext{
			Context:        c,
			SignedInUser:   &models.SignedInUser{},
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
		case initContextWithRenderAuth(ctx, renderService):
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
			if err := bus.Dispatch(&models.UpdateUserLastSeenAtCommand{UserId: ctx.UserId}); err != nil {
				ctx.Logger.Error("Failed to update last_seen_at", "error", err)
			}
		}
	}
}

func initContextWithAnonymousUser(ctx *models.ReqContext) bool {
	if !setting.AnonymousEnabled {
		return false
	}

	orgQuery := models.GetOrgByNameQuery{Name: setting.AnonymousOrgName}
	if err := bus.Dispatch(&orgQuery); err != nil {
		log.Errorf(3, "Anonymous access organization error: '%s': %s", setting.AnonymousOrgName, err)
		return false
	}

	ctx.IsSignedIn = false
	ctx.AllowAnonymous = true
	ctx.SignedInUser = &models.SignedInUser{IsAnonymous: true}
	ctx.OrgRole = models.RoleType(setting.AnonymousOrgRole)
	ctx.OrgId = orgQuery.Result.Id
	ctx.OrgName = orgQuery.Result.Name
	return true
}

func initContextWithApiKey(ctx *models.ReqContext) bool {
	var keyString string
	if keyString = getApiKey(ctx); keyString == "" {
		return false
	}

	// base64 decode key
	decoded, err := apikeygen.Decode(keyString)
	if err != nil {
		ctx.JsonApiErr(401, errStringInvalidAPIKey, err)
		return true
	}

	// fetch key
	keyQuery := models.GetApiKeyByNameQuery{KeyName: decoded.Name, OrgId: decoded.OrgId}
	if err := bus.Dispatch(&keyQuery); err != nil {
		ctx.JsonApiErr(401, errStringInvalidAPIKey, err)
		return true
	}

	apikey := keyQuery.Result

	// validate api key
	isValid, err := apikeygen.IsValid(decoded, apikey.Key)
	if err != nil {
		ctx.JsonApiErr(500, "Validating API key failed", err)
		return true
	}
	if !isValid {
		ctx.JsonApiErr(401, errStringInvalidAPIKey, err)
		return true
	}

	// check for expiration
	if apikey.Expires != nil && *apikey.Expires <= getTime().Unix() {
		ctx.JsonApiErr(401, "Expired API key", err)
		return true
	}

	ctx.IsSignedIn = true
	ctx.SignedInUser = &models.SignedInUser{}
	ctx.OrgRole = apikey.Role
	ctx.ApiKeyId = apikey.Id
	ctx.OrgId = apikey.OrgId
	return true
}

func initContextWithBasicAuth(ctx *models.ReqContext, orgId int64) bool {
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

	authQuery := models.LoginUserQuery{
		Username: username,
		Password: password,
	}
	if err := bus.Dispatch(&authQuery); err != nil {
		ctx.Logger.Debug(
			"Failed to authorize the user",
			"username", username,
			"err", err,
		)

		if err == models.ErrUserNotFound {
			err = login.ErrInvalidCredentials
		}
		ctx.JsonApiErr(401, errStringInvalidUsernamePassword, err)
		return true
	}

	user := authQuery.User

	query := models.GetSignedInUserQuery{UserId: user.Id, OrgId: orgId}
	if err := bus.Dispatch(&query); err != nil {
		ctx.Logger.Error(
			"Failed at user signed in",
			"id", user.Id,
			"org", orgId,
		)
		ctx.JsonApiErr(401, errStringInvalidUsernamePassword, err)
		return true
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	return true
}

func initContextWithToken(authTokenService models.UserTokenService, ctx *models.ReqContext, orgID int64) bool {
	if setting.LoginCookieName == "" {
		return false
	}

	rawToken := ctx.GetCookie(setting.LoginCookieName)
	if rawToken == "" {
		return false
	}

	token, err := authTokenService.LookupToken(ctx.Req.Context(), rawToken)
	if err != nil {
		ctx.Logger.Error("Failed to look up user based on cookie", "error", err)
		WriteSessionCookie(ctx, "", -1)
		return false
	}

	query := models.GetSignedInUserQuery{UserId: token.UserId, OrgId: orgID}
	if err := bus.Dispatch(&query); err != nil {
		ctx.Logger.Error("Failed to get user with id", "userId", token.UserId, "error", err)
		return false
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	ctx.UserToken = token

	// Rotate the token just before we write response headers to ensure there is no delay between
	// the new token being generated and the client receiving it.
	ctx.Resp.Before(rotateEndOfRequestFunc(ctx, authTokenService, token))

	return true
}

func rotateEndOfRequestFunc(ctx *models.ReqContext, authTokenService models.UserTokenService, token *models.UserToken) macaron.BeforeFunc {
	return func(w macaron.ResponseWriter) {
		// if response has already been written, skip.
		if w.Written() {
			return
		}

		// if the request is cancelled by the client we should not try
		// to rotate the token since the client would not accept any result.
		if ctx.Context.Req.Context().Err() == context.Canceled {
			return
		}

		rotated, err := authTokenService.TryRotateToken(ctx.Req.Context(), token, ctx.RemoteAddr(), ctx.Req.UserAgent())
		if err != nil {
			ctx.Logger.Error("Failed to rotate token", "error", err)
			return
		}

		if rotated {
			WriteSessionCookie(ctx, token.UnhashedToken, setting.LoginMaxLifetime)
		}
	}
}

func WriteSessionCookie(ctx *models.ReqContext, value string, maxLifetime time.Duration) {
	if setting.Env == setting.DEV {
		ctx.Logger.Info("New token", "unhashed token", value)
	}

	var maxAge int
	if maxLifetime <= 0 {
		maxAge = -1
	} else {
		maxAge = int(maxLifetime.Seconds())
	}

	WriteCookie(ctx.Resp, setting.LoginCookieName, url.QueryEscape(value), maxAge, newCookieOptions)
}

func AddDefaultResponseHeaders() macaron.Handler {
	return func(ctx *macaron.Context) {
		ctx.Resp.Before(func(w macaron.ResponseWriter) {
			// if response has already been written, skip.
			if w.Written() {
				return
			}

			if !strings.HasPrefix(ctx.Req.URL.Path, "/api/datasources/proxy/") {
				AddNoCacheHeaders(ctx.Resp)
			}

			if !setting.AllowEmbedding {
				AddXFrameOptionsDenyHeader(w)
			}

			AddSecurityHeaders(w)
		})
	}
}

// AddSecurityHeaders adds various HTTP(S) response headers that enable various security protections behaviors in the client's browser.
func AddSecurityHeaders(w macaron.ResponseWriter) {
	if (setting.Protocol == setting.HTTPS || setting.Protocol == setting.HTTP2) && setting.StrictTransportSecurity {
		strictHeaderValues := []string{fmt.Sprintf("max-age=%v", setting.StrictTransportSecurityMaxAge)}
		if setting.StrictTransportSecurityPreload {
			strictHeaderValues = append(strictHeaderValues, "preload")
		}
		if setting.StrictTransportSecuritySubDomains {
			strictHeaderValues = append(strictHeaderValues, "includeSubDomains")
		}
		w.Header().Add("Strict-Transport-Security", strings.Join(strictHeaderValues, "; "))
	}

	if setting.ContentTypeProtectionHeader {
		w.Header().Add("X-Content-Type-Options", "nosniff")
	}

	if setting.XSSProtectionHeader {
		w.Header().Add("X-XSS-Protection", "1; mode=block")
	}
}

func AddNoCacheHeaders(w macaron.ResponseWriter) {
	w.Header().Add("Cache-Control", "no-cache")
	w.Header().Add("Pragma", "no-cache")
	w.Header().Add("Expires", "-1")
}

func AddXFrameOptionsDenyHeader(w macaron.ResponseWriter) {
	w.Header().Add("X-Frame-Options", "deny")
}

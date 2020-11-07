// Package middleware contains HTTP server middleware.
package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/authproxy"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"gopkg.in/macaron.v1"
)

const (
	serviceName                      = "MiddlewareService"
	errStringInvalidAPIKey           = "Invalid API key"
	errStringInvalidUsernamePassword = "Invalid username or password"
)

var getTime = time.Now

func init() {
	svc := &MiddlewareService{}
	svc.register()
}

// register registers service with DI system.
func (s *MiddlewareService) register() {
	registry.Register(&registry.Descriptor{
		Name:         serviceName,
		Instance:     s,
		InitPriority: registry.High,
	})
}

// MiddlewareService is a service providing HTTP server middleware.
type MiddlewareService struct {
	RenderService      rendering.Service        `inject:""`
	Cfg                *setting.Cfg             `inject:""`
	RemoteCacheService *remotecache.RemoteCache `inject:""`
	AuthTokenService   models.UserTokenService  `inject:""`

	logger log.Logger
}

// Init gets called by the DI system to initialize the service.
func (s *MiddlewareService) Init() error {
	s.logger = log.New("MiddlewareService")
	return nil
}

// ContextHandler handles context.
func (s *MiddlewareService) ContextHandler(c *macaron.Context) {
	ctx := &models.ReqContext{
		Context:        c,
		SignedInUser:   &models.SignedInUser{},
		IsSignedIn:     false,
		AllowAnonymous: false,
		SkipCache:      false,
		Logger:         log.New("context"),
	}

	orgID := int64(0)
	orgIDHeader := ctx.Req.Header.Get("X-Grafana-Org-Id")
	if orgIDHeader != "" {
		var err error
		orgID, err = strconv.ParseInt(orgIDHeader, 10, 64)
		if err != nil {
			ctx.JsonApiErr(400, "Invalid X-Grafana-Org-Id header", nil)
			return
		}
	}

	// the order in which these are tested are important
	// look for api key in Authorization header first
	// then init session and look for userId in session
	// then look for api key in session (special case for render calls via api)
	// then test if anonymous access is enabled
	switch {
	case s.initContextWithRenderAuth(ctx):
	case s.initContextWithAPIKey(ctx):
	case s.initContextWithBasicAuth(ctx, orgID):
	case s.initContextWithAuthProxy(ctx, orgID):
	case s.initContextWithToken(ctx, orgID):
	case s.initContextWithAnonymousUser(ctx):
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

func (s *MiddlewareService) initContextWithRenderAuth(ctx *models.ReqContext) bool {
	key := ctx.GetCookie("renderKey")
	if key == "" {
		return false
	}

	renderUser, exists := s.RenderService.GetRenderUser(key)
	if !exists {
		ctx.JsonApiErr(401, "Invalid Render Key", nil)
		return true
	}

	ctx.IsSignedIn = true
	ctx.SignedInUser = &models.SignedInUser{
		OrgId:   renderUser.OrgID,
		UserId:  renderUser.UserID,
		OrgRole: models.RoleType(renderUser.OrgRole),
	}
	ctx.IsRenderCall = true
	ctx.LastSeenAt = time.Now()
	return true
}

func (s *MiddlewareService) initContextWithAPIKey(ctx *models.ReqContext) bool {
	var keyString string
	header := ctx.Req.Header.Get("Authorization")
	parts := strings.SplitN(header, " ", 2)
	if len(parts) == 2 && parts[0] == "Bearer" {
		keyString = parts[1]
	} else {
		username, password, err := util.DecodeBasicAuthHeader(header)
		if err != nil || username != "api_key" {
			return false
		}

		keyString = password
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

func (s *MiddlewareService) initContextWithBasicAuth(ctx *models.ReqContext, orgID int64) bool {
	if !s.Cfg.BasicAuthEnabled {
		return false
	}

	header := ctx.Req.Header.Get("Authorization")
	if header == "" {
		return false
	}

	username, password, err := util.DecodeBasicAuthHeader(header)
	if err != nil {
		ctx.JsonApiErr(401, "Invalid basic auth header", err)
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

	query := models.GetSignedInUserQuery{UserId: user.Id, OrgId: orgID}
	if err := bus.Dispatch(&query); err != nil {
		ctx.Logger.Error(
			"Failed at user signed in",
			"id", user.Id,
			"org", orgID,
		)
		ctx.JsonApiErr(401, errStringInvalidUsernamePassword, err)
		return true
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	return true
}

func (s *MiddlewareService) initContextWithAuthProxy(ctx *models.ReqContext, orgID int64) bool {
	username := ctx.Req.Header.Get(setting.AuthProxyHeaderName)
	auth := authproxy.New(&authproxy.Options{
		RemoteCacheService: s.RemoteCacheService,
		Ctx:                ctx,
		OrgID:              orgID,
	})

	logger := log.New("auth.proxy")

	// Bail if auth proxy is not enabled
	if !auth.IsEnabled() {
		return false
	}

	// If there is no header - we can't move forward
	if !auth.HasHeader() {
		return false
	}

	// Check if allowed to continue with this IP
	if result, err := auth.IsAllowedIP(); !result {
		logger.Error(
			"Failed to check whitelisted IP addresses",
			"message", err.Error(),
			"error", err.DetailsError,
		)
		ctx.Handle(407, err.Error(), err.DetailsError)
		return true
	}

	id, err := s.logUserIn(auth, username, logger, false)
	if err != nil {
		ctx.Handle(407, err.Error(), err.DetailsError)
		return true
	}

	logger.Debug("Got user ID, getting full user info", "userID", id)

	user, err := auth.GetSignedUser(id)
	if err != nil {
		// The reason we couldn't find the user corresponding to the ID might be that the ID was found from a stale
		// cache entry. For example, if a user is deleted via the API, corresponding cache entries aren't invalidated
		// because cache keys are computed from request header values and not just the user ID. Meaning that
		// we can't easily derive cache keys to invalidate when deleting a user. To work around this, we try to
		// log the user in again without the cache.
		logger.Debug("Failed to get user info given ID, retrying without cache", "userID", id)
		if err := auth.RemoveUserFromCache(logger); err != nil {
			if !errors.Is(err, remotecache.ErrCacheItemNotFound) {
				logger.Error("Got unexpected error when removing user from auth cache", "error", err)
			}
		}
		id, err = s.logUserIn(auth, username, logger, true)
		if err != nil {
			ctx.Handle(407, err.Error(), err.DetailsError)
			return true
		}

		user, err = auth.GetSignedUser(id)
		if err != nil {
			ctx.Handle(407, err.Error(), err.DetailsError)
			return true
		}
	}

	logger.Debug("Successfully got user info", "userID", user.UserId, "username", user.Login)

	// Add user info to context
	ctx.SignedInUser = user
	ctx.IsSignedIn = true

	// Remember user data in cache
	if err := auth.Remember(id); err != nil {
		logger.Error(
			"Failed to store user in cache",
			"username", username,
			"message", err.Error(),
			"error", err.DetailsError,
		)
		ctx.Handle(500, err.Error(), err.DetailsError)
		return true
	}

	return true
}

func (s *MiddlewareService) logUserIn(auth *authproxy.AuthProxy, username string, logger log.Logger, ignoreCache bool) (int64, *authproxy.Error) {
	logger.Debug("Trying to log user in", "username", username, "ignoreCache", ignoreCache)
	// Try to log in user via various providers
	id, err := auth.Login(logger, ignoreCache)
	if err != nil {
		logger.Error("Failed to login", "username", username, "message", err.Error(), "error", err.DetailsError,
			"ignoreCache", ignoreCache)
		return 0, err
	}
	return id, nil
}

func (s *MiddlewareService) initContextWithToken(ctx *models.ReqContext, orgID int64) bool {
	if setting.LoginCookieName == "" {
		return false
	}

	rawToken := ctx.GetCookie(setting.LoginCookieName)
	if rawToken == "" {
		return false
	}

	token, err := s.AuthTokenService.LookupToken(ctx.Req.Context(), rawToken)
	if err != nil {
		ctx.Logger.Error("Failed to look up user based on cookie", "error", err)
		s.WriteSessionCookie(ctx, "", -1)
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
	ctx.Resp.Before(s.rotateEndOfRequestFunc(ctx, token))

	return true
}

func (s *MiddlewareService) rotateEndOfRequestFunc(ctx *models.ReqContext, token *models.UserToken) macaron.BeforeFunc {
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

		rotated, err := s.AuthTokenService.TryRotateToken(
			ctx.Req.Context(), token, ctx.RemoteAddr(), ctx.Req.UserAgent(),
		)
		if err != nil {
			ctx.Logger.Error("Failed to rotate token", "error", err)
			return
		}

		if rotated {
			s.WriteSessionCookie(ctx, token.UnhashedToken, setting.LoginMaxLifetime)
		}
	}
}

func (s *MiddlewareService) WriteSessionCookie(ctx *models.ReqContext, value string, maxLifetime time.Duration) {
	if setting.Env == setting.Dev {
		ctx.Logger.Info("New token", "unhashed token", value)
	}

	var maxAge int
	if maxLifetime <= 0 {
		maxAge = -1
	} else {
		maxAge = int(maxLifetime.Seconds())
	}

	middleware.WriteCookie(ctx.Resp, setting.LoginCookieName, url.QueryEscape(value), maxAge, s.newCookieOptions)
}

func (s *MiddlewareService) initContextWithAnonymousUser(ctx *models.ReqContext) bool {
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

func (s *MiddlewareService) AddDefaultResponseHeaders(ctx *macaron.Context) {
	ctx.Resp.Before(func(w macaron.ResponseWriter) {
		// if response has already been written, skip.
		if w.Written() {
			return
		}

		if !strings.HasPrefix(ctx.Req.URL.Path, "/api/datasources/proxy/") {
			w.Header().Add("Cache-Control", "no-cache")
			w.Header().Add("Pragma", "no-cache")
			w.Header().Add("Expires", "-1")
		}

		if !s.Cfg.AllowEmbedding {
			w.Header().Add("X-Frame-Options", "deny")
		}

		s.addSecurityHeaders(w)
	})
}

// AddSecurityHeaders adds various HTTP(S) response headers that enable various security protections behaviors in the client's browser.
func (s *MiddlewareService) addSecurityHeaders(w macaron.ResponseWriter) {
	if (setting.Protocol == setting.HTTPSScheme || setting.Protocol == setting.HTTP2Scheme) &&
		setting.StrictTransportSecurity {
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

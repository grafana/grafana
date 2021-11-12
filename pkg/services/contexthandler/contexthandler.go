// Package contexthandler contains the ContextHandler service.
package contexthandler

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler/authproxy"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
	"github.com/opentracing/opentracing-go"
	ol "github.com/opentracing/opentracing-go/log"
	cw "github.com/weaveworks/common/tracing"
)

const (
	InvalidUsernamePassword = "invalid username or password"
	InvalidAPIKey           = "invalid API key"
)

const ServiceName = "ContextHandler"

func ProvideService(cfg *setting.Cfg, tokenService models.UserTokenService, jwtService models.JWTService,
	remoteCache *remotecache.RemoteCache, renderService rendering.Service, sqlStore *sqlstore.SQLStore) *ContextHandler {
	return &ContextHandler{
		Cfg:              cfg,
		AuthTokenService: tokenService,
		JWTAuthService:   jwtService,
		RemoteCache:      remoteCache,
		RenderService:    renderService,
		SQLStore:         sqlStore,
	}
}

// ContextHandler is a middleware.
type ContextHandler struct {
	Cfg              *setting.Cfg
	AuthTokenService models.UserTokenService
	JWTAuthService   models.JWTService
	RemoteCache      *remotecache.RemoteCache
	RenderService    rendering.Service
	SQLStore         *sqlstore.SQLStore

	// GetTime returns the current time.
	// Stubbable by tests.
	GetTime func() time.Time
}

type reqContextKey struct{}

// FromContext returns the ReqContext value stored in a context.Context, if any.
func FromContext(c context.Context) *models.ReqContext {
	if reqCtx, ok := c.Value(reqContextKey{}).(*models.ReqContext); ok {
		return reqCtx
	}
	return nil
}

// Middleware provides a middleware to initialize the Macaron context.
func (h *ContextHandler) Middleware(mContext *web.Context) {
	span, _ := opentracing.StartSpanFromContext(mContext.Req.Context(), "Auth - Middleware")
	defer span.Finish()

	reqContext := &models.ReqContext{
		Context:        mContext,
		SignedInUser:   &models.SignedInUser{},
		IsSignedIn:     false,
		AllowAnonymous: false,
		SkipCache:      false,
		Logger:         log.New("context"),
	}

	// Inject ReqContext into a request context and replace the request instance in the macaron context
	mContext.Req = mContext.Req.WithContext(context.WithValue(mContext.Req.Context(), reqContextKey{}, reqContext))
	mContext.Map(mContext.Req)

	traceID, exists := cw.ExtractTraceID(mContext.Req.Context())
	if exists {
		reqContext.Logger = reqContext.Logger.New("traceID", traceID)
	}

	const headerName = "X-Grafana-Org-Id"
	orgID := int64(0)
	orgIDHeader := reqContext.Req.Header.Get(headerName)
	if orgIDHeader != "" {
		id, err := strconv.ParseInt(orgIDHeader, 10, 64)
		if err == nil {
			orgID = id
		} else {
			reqContext.Logger.Debug("Received invalid header", "header", headerName, "value", orgIDHeader)
		}
	}

	if targetOrgId := reqContext.QueryInt64("targetOrgId"); targetOrgId != 0 {
		orgID = targetOrgId
	}

	// the order in which these are tested are important
	// look for api key in Authorization header first
	// then init session and look for userId in session
	// then look for api key in session (special case for render calls via api)
	// then test if anonymous access is enabled
	switch {
	case h.initContextWithRenderAuth(reqContext):
	case h.initContextWithAPIKey(reqContext):
	case h.initContextWithBasicAuth(reqContext, orgID):
	case h.initContextWithAuthProxy(reqContext, orgID):
	case h.initContextWithToken(reqContext, orgID):
	case h.initContextWithJWT(reqContext, orgID):
	case h.initContextWithAnonymousUser(reqContext):
	}

	reqContext.Logger = log.New("context", "userId", reqContext.UserId, "orgId", reqContext.OrgId, "uname", reqContext.Login)

	span.LogFields(
		ol.String("uname", reqContext.Login),
		ol.Int64("orgId", reqContext.OrgId),
		ol.Int64("userId", reqContext.UserId))

	mContext.Map(reqContext)

	// update last seen every 5min
	if reqContext.ShouldUpdateLastSeenAt() {
		reqContext.Logger.Debug("Updating last user_seen_at", "user_id", reqContext.UserId)
		if err := bus.DispatchCtx(mContext.Req.Context(), &models.UpdateUserLastSeenAtCommand{UserId: reqContext.UserId}); err != nil {
			reqContext.Logger.Error("Failed to update last_seen_at", "error", err)
		}
	}
}

func (h *ContextHandler) initContextWithAnonymousUser(reqContext *models.ReqContext) bool {
	if !h.Cfg.AnonymousEnabled {
		return false
	}

	span, _ := opentracing.StartSpanFromContext(reqContext.Req.Context(), "initContextWithAnonymousUser")
	defer span.Finish()

	org, err := h.SQLStore.GetOrgByName(h.Cfg.AnonymousOrgName)
	if err != nil {
		reqContext.Logger.Error("Anonymous access organization error.", "org_name", h.Cfg.AnonymousOrgName, "error", err)
		return false
	}

	reqContext.IsSignedIn = false
	reqContext.AllowAnonymous = true
	reqContext.SignedInUser = &models.SignedInUser{IsAnonymous: true}
	reqContext.OrgRole = models.RoleType(h.Cfg.AnonymousOrgRole)
	reqContext.OrgId = org.Id
	reqContext.OrgName = org.Name
	return true
}

func (h *ContextHandler) initContextWithAPIKey(reqContext *models.ReqContext) bool {
	header := reqContext.Req.Header.Get("Authorization")
	parts := strings.SplitN(header, " ", 2)
	var keyString string
	if len(parts) == 2 && parts[0] == "Bearer" {
		keyString = parts[1]
	} else {
		username, password, err := util.DecodeBasicAuthHeader(header)
		if err == nil && username == "api_key" {
			keyString = password
		}
	}

	if keyString == "" {
		return false
	}

	span, _ := opentracing.StartSpanFromContext(reqContext.Req.Context(), "initContextWithAPIKey")
	defer span.Finish()

	// base64 decode key
	decoded, err := apikeygen.Decode(keyString)
	if err != nil {
		reqContext.JsonApiErr(401, InvalidAPIKey, err)
		return true
	}

	// fetch key
	keyQuery := models.GetApiKeyByNameQuery{KeyName: decoded.Name, OrgId: decoded.OrgId}
	if err := bus.Dispatch(&keyQuery); err != nil {
		reqContext.JsonApiErr(401, InvalidAPIKey, err)
		return true
	}

	apikey := keyQuery.Result

	// validate api key
	isValid, err := apikeygen.IsValid(decoded, apikey.Key)
	if err != nil {
		reqContext.JsonApiErr(500, "Validating API key failed", err)
		return true
	}
	if !isValid {
		reqContext.JsonApiErr(401, InvalidAPIKey, err)
		return true
	}

	// check for expiration
	getTime := h.GetTime
	if getTime == nil {
		getTime = time.Now
	}
	if apikey.Expires != nil && *apikey.Expires <= getTime().Unix() {
		reqContext.JsonApiErr(401, "Expired API key", err)
		return true
	}

	if apikey.ServiceAccountId < 1 { //There is no service account attached to the apikey
		//Use the old APIkey method.  This provides backwards compatibility.
		reqContext.SignedInUser = &models.SignedInUser{}
		reqContext.OrgRole = apikey.Role
		reqContext.ApiKeyId = apikey.Id
		reqContext.OrgId = apikey.OrgId
		reqContext.IsSignedIn = true
		return true
	}

	//There is a service account attached to the API key

	//Use service account linked to API key as the signed in user
	query := models.GetSignedInUserQuery{UserId: apikey.ServiceAccountId, OrgId: apikey.OrgId}
	if err := bus.Dispatch(&query); err != nil {
		reqContext.Logger.Error(
			"Failed to link API key to service account in",
			"id", query.UserId,
			"org", query.OrgId,
			"err", err,
		)
		reqContext.JsonApiErr(500, "Unable to link API key to service account", err)
		return true
	}

	reqContext.IsSignedIn = true
	reqContext.SignedInUser = query.Result
	return true
}

func (h *ContextHandler) initContextWithBasicAuth(reqContext *models.ReqContext, orgID int64) bool {
	if !h.Cfg.BasicAuthEnabled {
		return false
	}

	header := reqContext.Req.Header.Get("Authorization")
	if header == "" {
		return false
	}

	span, ctx := opentracing.StartSpanFromContext(reqContext.Req.Context(), "initContextWithBasicAuth")
	defer span.Finish()

	username, password, err := util.DecodeBasicAuthHeader(header)
	if err != nil {
		reqContext.JsonApiErr(401, "Invalid Basic Auth Header", err)
		return true
	}

	authQuery := models.LoginUserQuery{
		Username: username,
		Password: password,
		Cfg:      h.Cfg,
	}
	if err := bus.DispatchCtx(reqContext.Req.Context(), &authQuery); err != nil {
		reqContext.Logger.Debug(
			"Failed to authorize the user",
			"username", username,
			"err", err,
		)

		if errors.Is(err, models.ErrUserNotFound) {
			err = login.ErrInvalidCredentials
		}
		reqContext.JsonApiErr(401, InvalidUsernamePassword, err)
		return true
	}

	user := authQuery.User

	query := models.GetSignedInUserQuery{UserId: user.Id, OrgId: orgID}
	if err := bus.DispatchCtx(ctx, &query); err != nil {
		reqContext.Logger.Error(
			"Failed at user signed in",
			"id", user.Id,
			"org", orgID,
		)
		reqContext.JsonApiErr(401, InvalidUsernamePassword, err)
		return true
	}

	reqContext.SignedInUser = query.Result
	reqContext.IsSignedIn = true
	return true
}

func (h *ContextHandler) initContextWithToken(reqContext *models.ReqContext, orgID int64) bool {
	if h.Cfg.LoginCookieName == "" {
		return false
	}

	rawToken := reqContext.GetCookie(h.Cfg.LoginCookieName)
	if rawToken == "" {
		return false
	}

	span, ctx := opentracing.StartSpanFromContext(reqContext.Req.Context(), "initContextWithToken")
	defer span.Finish()

	token, err := h.AuthTokenService.LookupToken(ctx, rawToken)
	if err != nil {
		reqContext.Logger.Error("Failed to look up user based on cookie", "error", err)
		reqContext.LookupTokenErr = err
		return false
	}

	query := models.GetSignedInUserQuery{UserId: token.UserId, OrgId: orgID}
	if err := bus.DispatchCtx(ctx, &query); err != nil {
		reqContext.Logger.Error("Failed to get user with id", "userId", token.UserId, "error", err)
		return false
	}

	reqContext.SignedInUser = query.Result
	reqContext.IsSignedIn = true
	reqContext.UserToken = token

	// Rotate the token just before we write response headers to ensure there is no delay between
	// the new token being generated and the client receiving it.
	reqContext.Resp.Before(h.rotateEndOfRequestFunc(reqContext, h.AuthTokenService, token))

	return true
}

func (h *ContextHandler) rotateEndOfRequestFunc(reqContext *models.ReqContext, authTokenService models.UserTokenService,
	token *models.UserToken) web.BeforeFunc {
	return func(w web.ResponseWriter) {
		// if response has already been written, skip.
		if w.Written() {
			return
		}

		// if the request is cancelled by the client we should not try
		// to rotate the token since the client would not accept any result.
		if errors.Is(reqContext.Context.Req.Context().Err(), context.Canceled) {
			return
		}

		span, ctx := opentracing.StartSpanFromContext(reqContext.Req.Context(), "rotateEndOfRequestFunc")
		defer span.Finish()

		addr := reqContext.RemoteAddr()
		ip, err := network.GetIPFromAddress(addr)
		if err != nil {
			reqContext.Logger.Debug("Failed to get client IP address", "addr", addr, "err", err)
			ip = nil
		}
		rotated, err := authTokenService.TryRotateToken(ctx, token, ip, reqContext.Req.UserAgent())
		if err != nil {
			reqContext.Logger.Error("Failed to rotate token", "error", err)
			return
		}

		if rotated {
			cookies.WriteSessionCookie(reqContext, h.Cfg, token.UnhashedToken, h.Cfg.LoginMaxLifetime)
		}
	}
}

func (h *ContextHandler) initContextWithRenderAuth(reqContext *models.ReqContext) bool {
	key := reqContext.GetCookie("renderKey")
	if key == "" {
		return false
	}

	span, _ := opentracing.StartSpanFromContext(reqContext.Req.Context(), "initContextWithRenderAuth")
	defer span.Finish()

	renderUser, exists := h.RenderService.GetRenderUser(key)
	if !exists {
		reqContext.JsonApiErr(401, "Invalid Render Key", nil)
		return true
	}

	reqContext.IsSignedIn = true
	reqContext.SignedInUser = &models.SignedInUser{
		OrgId:   renderUser.OrgID,
		UserId:  renderUser.UserID,
		OrgRole: models.RoleType(renderUser.OrgRole),
	}
	reqContext.IsRenderCall = true
	reqContext.LastSeenAt = time.Now()
	return true
}

func logUserIn(auth *authproxy.AuthProxy, username string, logger log.Logger, ignoreCache bool) (int64, error) {
	logger.Debug("Trying to log user in", "username", username, "ignoreCache", ignoreCache)
	// Try to log in user via various providers
	id, err := auth.Login(logger, ignoreCache)
	if err != nil {
		details := err
		var e authproxy.Error
		if errors.As(err, &e) {
			details = e.DetailsError
		}
		logger.Error("Failed to login", "username", username, "message", err.Error(), "error", details,
			"ignoreCache", ignoreCache)
		return 0, err
	}
	return id, nil
}

func (h *ContextHandler) handleError(ctx *models.ReqContext, err error, statusCode int, cb func(error)) {
	details := err
	var e authproxy.Error
	if errors.As(err, &e) {
		details = e.DetailsError
	}
	ctx.Handle(h.Cfg, statusCode, err.Error(), details)

	if cb != nil {
		cb(details)
	}
}

func (h *ContextHandler) initContextWithAuthProxy(reqContext *models.ReqContext, orgID int64) bool {
	username := reqContext.Req.Header.Get(h.Cfg.AuthProxyHeaderName)
	auth := authproxy.New(h.Cfg, &authproxy.Options{
		RemoteCache: h.RemoteCache,
		Ctx:         reqContext,
		OrgID:       orgID,
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

	span, _ := opentracing.StartSpanFromContext(reqContext.Req.Context(), "initContextWithAuthProxy")
	defer span.Finish()

	// Check if allowed to continue with this IP
	if err := auth.IsAllowedIP(); err != nil {
		h.handleError(reqContext, err, 407, func(details error) {
			logger.Error("Failed to check whitelisted IP addresses", "message", err.Error(), "error", details)
		})
		return true
	}

	id, err := logUserIn(auth, username, logger, false)
	if err != nil {
		h.handleError(reqContext, err, 407, nil)
		return true
	}

	logger.Debug("Got user ID, getting full user info", "userID", id)

	user, err := auth.GetSignedInUser(id)
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
		id, err = logUserIn(auth, username, logger, true)
		if err != nil {
			h.handleError(reqContext, err, 407, nil)
			return true
		}

		user, err = auth.GetSignedInUser(id)
		if err != nil {
			h.handleError(reqContext, err, 407, nil)
			return true
		}
	}

	logger.Debug("Successfully got user info", "userID", user.UserId, "username", user.Login)

	// Add user info to context
	reqContext.SignedInUser = user
	reqContext.IsSignedIn = true

	// Remember user data in cache
	if err := auth.Remember(id); err != nil {
		h.handleError(reqContext, err, 500, func(details error) {
			logger.Error(
				"Failed to store user in cache",
				"username", username,
				"message", err.Error(),
				"error", details,
			)
		})
		return true
	}

	return true
}

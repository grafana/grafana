// Package contexthandler contains the ContextHandler service.
package contexthandler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/components/apikeygen"
	apikeygenprefix "github.com/grafana/grafana/pkg/components/apikeygenprefixed"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	loginpkg "github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/services/anonymous"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/contexthandler/authproxy"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

const (
	InvalidUsernamePassword = "invalid username or password"
	/* #nosec */
	InvalidAPIKey = "invalid API key"
)

const ServiceName = "ContextHandler"

func ProvideService(cfg *setting.Cfg, tokenService auth.UserTokenService, jwtService jwt.JWTService,
	remoteCache *remotecache.RemoteCache, renderService rendering.Service, sqlStore db.DB,
	tracer tracing.Tracer, authProxy *authproxy.AuthProxy, loginService login.Service,
	apiKeyService apikey.Service, authenticator loginpkg.Authenticator, userService user.Service,
	orgService org.Service, oauthTokenService oauthtoken.OAuthTokenService, features *featuremgmt.FeatureManager,
	authnService authn.Service, anonSessionService anonymous.Service,
) *ContextHandler {
	return &ContextHandler{
		Cfg:                cfg,
		AuthTokenService:   tokenService,
		JWTAuthService:     jwtService,
		RemoteCache:        remoteCache,
		RenderService:      renderService,
		SQLStore:           sqlStore,
		tracer:             tracer,
		authProxy:          authProxy,
		authenticator:      authenticator,
		loginService:       loginService,
		apiKeyService:      apiKeyService,
		userService:        userService,
		orgService:         orgService,
		oauthTokenService:  oauthTokenService,
		features:           features,
		authnService:       authnService,
		anonSessionService: anonSessionService,
		singleflight:       new(singleflight.Group),
	}
}

// ContextHandler is a middleware.
type ContextHandler struct {
	Cfg                *setting.Cfg
	AuthTokenService   auth.UserTokenService
	JWTAuthService     auth.JWTVerifierService
	RemoteCache        *remotecache.RemoteCache
	RenderService      rendering.Service
	SQLStore           db.DB
	tracer             tracing.Tracer
	authProxy          *authproxy.AuthProxy
	authenticator      loginpkg.Authenticator
	loginService       login.Service
	apiKeyService      apikey.Service
	userService        user.Service
	orgService         org.Service
	oauthTokenService  oauthtoken.OAuthTokenService
	features           *featuremgmt.FeatureManager
	authnService       authn.Service
	singleflight       *singleflight.Group
	anonSessionService anonymous.Service
	// GetTime returns the current time.
	// Stubbable by tests.
	GetTime func() time.Time
}

type reqContextKey = ctxkey.Key

// FromContext returns the ReqContext value stored in a context.Context, if any.
func FromContext(c context.Context) *contextmodel.ReqContext {
	if reqCtx, ok := c.Value(reqContextKey{}).(*contextmodel.ReqContext); ok {
		return reqCtx
	}
	return nil
}

// Middleware provides a middleware to initialize the request context.
func (h *ContextHandler) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		mContext := web.FromContext(ctx)
		_, span := h.tracer.Start(ctx, "Auth - Middleware")
		defer span.End()

		reqContext := &contextmodel.ReqContext{
			Context:        mContext,
			SignedInUser:   &user.SignedInUser{},
			IsSignedIn:     false,
			AllowAnonymous: false,
			SkipCache:      false,
			Logger:         log.New("context"),
		}

		// Inject ReqContext into http.Request.Context
		*r = *r.WithContext(context.WithValue(ctx, reqContextKey{}, reqContext))

		traceID := tracing.TraceIDFromContext(mContext.Req.Context(), false)
		if traceID != "" {
			reqContext.Logger = reqContext.Logger.New("traceID", traceID)
		}

		if h.features.IsEnabled(featuremgmt.FlagAuthnService) {
			identity, err := h.authnService.Authenticate(ctx, &authn.Request{HTTPRequest: reqContext.Req, Resp: reqContext.Resp})
			if err != nil {
				if errors.Is(err, auth.ErrUserTokenNotFound) || errors.Is(err, auth.ErrInvalidSessionToken) {
					// Burn the cookie in case of invalid, expired or missing token
					reqContext.Resp.Before(h.deleteInvalidCookieEndOfRequestFunc(reqContext))
				}
				// Hack: set all errors on LookupTokenErr, so we can check it in auth middlewares
				reqContext.LookupTokenErr = err
			} else {
				reqContext.IsSignedIn = true
				reqContext.UserToken = identity.SessionToken
				reqContext.SignedInUser = identity.SignedInUser()
				reqContext.AllowAnonymous = identity.IsAnonymous
				reqContext.IsRenderCall = identity.AuthModule == login.RenderModule
				// FIXME (kallep): Add auth headers used to context
			}
		} else {
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

			queryParameters, err := url.ParseQuery(reqContext.Req.URL.RawQuery)
			if err != nil {
				reqContext.Logger.Error("Failed to parse query parameters", "error", err)
			}
			if queryParameters.Has("targetOrgId") {
				targetOrg, err := strconv.ParseInt(queryParameters.Get("targetOrgId"), 10, 64)
				if err == nil {
					orgID = targetOrg
				} else {
					reqContext.Logger.Error("Invalid target organization ID", "error", err)
				}
			}
			// the order in which these are tested are important
			// look for api key in Authorization header first
			// then init session and look for userId in session
			// then look for api key in session (special case for render calls via api)
			// then test if anonymous access is enabled
			switch {
			case h.initContextWithRenderAuth(reqContext):
			case h.initContextWithJWT(reqContext, orgID):
			case h.initContextWithAPIKey(reqContext):
			case h.initContextWithBasicAuth(reqContext, orgID):
			case h.initContextWithAuthProxy(reqContext, orgID):
			case h.initContextWithToken(reqContext, orgID):
			case h.initContextWithAnonymousUser(reqContext):
			}
		}

		reqContext.Logger = reqContext.Logger.New("userId", reqContext.UserID, "orgId", reqContext.OrgID, "uname", reqContext.Login)
		span.AddEvents(
			[]string{"uname", "orgId", "userId"},
			[]tracing.EventValue{
				{Str: reqContext.Login},
				{Num: reqContext.OrgID},
				{Num: reqContext.UserID}},
		)

		// when using authn service this is implemented as a post auth hook
		if !h.features.IsEnabled(featuremgmt.FlagAuthnService) {
			// update last seen every 5min
			if reqContext.ShouldUpdateLastSeenAt() {
				reqContext.Logger.Debug("Updating last user_seen_at", "user_id", reqContext.UserID)
				if err := h.userService.UpdateLastSeenAt(mContext.Req.Context(), &user.UpdateUserLastSeenAtCommand{UserID: reqContext.UserID}); err != nil {
					reqContext.Logger.Error("Failed to update last_seen_at", "error", err)
				}
			}
		}

		// this can be used by proxies to identify certain users
		if h.features.IsEnabled(featuremgmt.FlagReturnUnameHeader) {
			w.Header().Add("grafana-uname", reqContext.Login)
		}

		next.ServeHTTP(w, r)
	})
}

func (h *ContextHandler) initContextWithAnonymousUser(reqContext *contextmodel.ReqContext) bool {
	_, span := h.tracer.Start(reqContext.Req.Context(), "initContextWithAnonymousUser")
	defer span.End()

	if !h.Cfg.AnonymousEnabled {
		return false
	}

	getOrg := org.GetOrgByNameQuery{Name: h.Cfg.AnonymousOrgName}

	orga, err := h.orgService.GetByName(reqContext.Req.Context(), &getOrg)
	if err != nil {
		reqContext.Logger.Error("Anonymous access organization error.", "org_name", h.Cfg.AnonymousOrgName, "error", err)
		return false
	}

	go func() {
		defer func() {
			if err := recover(); err != nil {
				reqContext.Logger.Warn("tag anon session panic", "err", err)
			}
		}()
		if err := h.anonSessionService.TagSession(context.Background(), reqContext.Req); err != nil {
			reqContext.Logger.Warn("Failed to tag anonymous session", "error", err)
		}
	}()

	reqContext.IsSignedIn = false
	reqContext.AllowAnonymous = true
	reqContext.SignedInUser = &user.SignedInUser{IsAnonymous: true}
	reqContext.OrgRole = org.RoleType(h.Cfg.AnonymousOrgRole)
	reqContext.OrgID = orga.ID
	reqContext.OrgName = orga.Name
	return true
}

func (h *ContextHandler) getPrefixedAPIKey(ctx context.Context, keyString string) (*apikey.APIKey, error) {
	// prefixed decode key
	decoded, err := apikeygenprefix.Decode(keyString)
	if err != nil {
		return nil, err
	}

	hash, err := decoded.Hash()
	if err != nil {
		return nil, err
	}

	return h.apiKeyService.GetAPIKeyByHash(ctx, hash)
}

func (h *ContextHandler) getAPIKey(ctx context.Context, keyString string) (*apikey.APIKey, error) {
	decoded, err := apikeygen.Decode(keyString)
	if err != nil {
		return nil, err
	}

	// fetch key
	keyQuery := apikey.GetByNameQuery{KeyName: decoded.Name, OrgId: decoded.OrgId}
	if err := h.apiKeyService.GetApiKeyByName(ctx, &keyQuery); err != nil {
		return nil, err
	}

	// validate api key
	isValid, err := apikeygen.IsValid(decoded, keyQuery.Result.Key)
	if err != nil {
		return nil, err
	}
	if !isValid {
		return nil, apikeygen.ErrInvalidApiKey
	}

	return keyQuery.Result, nil
}

func (h *ContextHandler) initContextWithAPIKey(reqContext *contextmodel.ReqContext) bool {
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

	_, span := h.tracer.Start(reqContext.Req.Context(), "initContextWithAPIKey")
	defer span.End()

	ctx := WithAuthHTTPHeader(reqContext.Req.Context(), "Authorization")
	*reqContext.Req = *reqContext.Req.WithContext(ctx)

	var (
		apiKey *apikey.APIKey
		errKey error
	)
	if strings.HasPrefix(keyString, apikeygenprefix.GrafanaPrefix) {
		apiKey, errKey = h.getPrefixedAPIKey(reqContext.Req.Context(), keyString) // decode prefixed key
	} else {
		apiKey, errKey = h.getAPIKey(reqContext.Req.Context(), keyString) // decode legacy api key
	}

	if errKey != nil {
		status := http.StatusInternalServerError
		if errors.Is(errKey, apikeygen.ErrInvalidApiKey) {
			status = http.StatusUnauthorized
		}
		// this is when the getPrefixAPIKey return error form the apikey package instead of the apikeygen
		// when called in the sqlx store methods
		if errors.Is(errKey, apikey.ErrInvalid) {
			status = http.StatusUnauthorized
		}
		reqContext.JsonApiErr(status, InvalidAPIKey, errKey)
		return true
	}

	// check for expiration
	getTime := h.GetTime
	if getTime == nil {
		getTime = time.Now
	}
	if apiKey.Expires != nil && *apiKey.Expires <= getTime().Unix() {
		reqContext.JsonApiErr(http.StatusUnauthorized, "Expired API key", nil)
		return true
	}

	if apiKey.IsRevoked != nil && *apiKey.IsRevoked {
		reqContext.JsonApiErr(http.StatusUnauthorized, "Revoked token", nil)

		return true
	}

	// non-blocking update api_key last used date
	go func(id int64) {
		defer func() {
			if err := recover(); err != nil {
				reqContext.Logger.Error("api key authentication panic", "err", err)
			}
		}()
		if err := h.apiKeyService.UpdateAPIKeyLastUsedDate(context.Background(), id); err != nil {
			reqContext.Logger.Warn("failed to update last use date for api key", "id", id)
		}
	}(apiKey.Id)

	if apiKey.ServiceAccountId == nil || *apiKey.ServiceAccountId < 1 { //There is no service account attached to the apikey
		// Use the old APIkey method.  This provides backwards compatibility.
		// will probably have to be supported for a long time.
		reqContext.SignedInUser = &user.SignedInUser{}
		reqContext.OrgRole = apiKey.Role
		reqContext.ApiKeyID = apiKey.Id
		reqContext.OrgID = apiKey.OrgId
		reqContext.IsSignedIn = true
		return true
	}

	//There is a service account attached to the API key

	//Use service account linked to API key as the signed in user
	querySignedInUser := user.GetSignedInUserQuery{UserID: *apiKey.ServiceAccountId, OrgID: apiKey.OrgId}
	querySignedInUserResult, err := h.userService.GetSignedInUserWithCacheCtx(reqContext.Req.Context(), &querySignedInUser)
	if err != nil {
		reqContext.Logger.Error(
			"Failed to link API key to service account in",
			"id", querySignedInUser.UserID,
			"org", querySignedInUser.OrgID,
			"err", err,
		)
		reqContext.JsonApiErr(http.StatusInternalServerError, "Unable to link API key to service account", err)
		return true
	}

	// disabled service accounts are not allowed to access the API
	if querySignedInUserResult.IsDisabled {
		reqContext.JsonApiErr(http.StatusUnauthorized, "Service account is disabled", nil)
		return true
	}

	reqContext.IsSignedIn = true
	reqContext.SignedInUser = querySignedInUserResult

	return true
}

func (h *ContextHandler) initContextWithBasicAuth(reqContext *contextmodel.ReqContext, orgID int64) bool {
	if !h.Cfg.BasicAuthEnabled {
		return false
	}

	header := reqContext.Req.Header.Get("Authorization")
	if header == "" {
		return false
	}

	_, span := h.tracer.Start(reqContext.Req.Context(), "initContextWithBasicAuth")
	defer span.End()

	username, password, err := util.DecodeBasicAuthHeader(header)
	if err != nil {
		reqContext.JsonApiErr(401, "Invalid Basic Auth Header", err)
		return true
	}

	ctx := WithAuthHTTPHeader(reqContext.Req.Context(), "Authorization")
	*reqContext.Req = *reqContext.Req.WithContext(ctx)

	authQuery := login.LoginUserQuery{
		Username: username,
		Password: password,
		Cfg:      h.Cfg,
	}
	if err := h.authenticator.AuthenticateUser(ctx, &authQuery); err != nil {
		reqContext.Logger.Debug(
			"Failed to authorize the user",
			"username", username,
			"err", err,
		)

		if errors.Is(err, user.ErrUserNotFound) {
			err = login.ErrInvalidCredentials
		}
		reqContext.JsonApiErr(401, InvalidUsernamePassword, err)
		return true
	}

	usr := authQuery.User

	query := user.GetSignedInUserQuery{UserID: usr.ID, OrgID: orgID}
	queryResult, err := h.userService.GetSignedInUserWithCacheCtx(ctx, &query)
	if err != nil {
		reqContext.Logger.Error(
			"Failed at user signed in",
			"id", usr.ID,
			"org", orgID,
		)
		reqContext.JsonApiErr(401, InvalidUsernamePassword, err)
		return true
	}

	reqContext.SignedInUser = queryResult
	reqContext.IsSignedIn = true
	return true
}

func (h *ContextHandler) initContextWithToken(reqContext *contextmodel.ReqContext, orgID int64) bool {
	if h.Cfg.LoginCookieName == "" {
		return false
	}

	rawToken := reqContext.GetCookie(h.Cfg.LoginCookieName)
	if rawToken == "" {
		return false
	}

	ctx, span := h.tracer.Start(reqContext.Req.Context(), "initContextWithToken")
	defer span.End()

	token, err := h.AuthTokenService.LookupToken(ctx, rawToken)
	if err != nil {
		reqContext.Logger.Warn("failed to look up session from cookie", "error", err)
		if errors.Is(err, auth.ErrInvalidSessionToken) {
			// Burn the cookie in case of invalid or revoked token
			reqContext.Resp.Before(h.deleteInvalidCookieEndOfRequestFunc(reqContext))
		}

		reqContext.LookupTokenErr = err

		return false
	}

	query := user.GetSignedInUserQuery{UserID: token.UserId, OrgID: orgID}
	queryResult, err := h.userService.GetSignedInUserWithCacheCtx(ctx, &query)
	if err != nil {
		reqContext.Logger.Error("Failed to get user with id", "userId", token.UserId, "error", err)
		return false
	}

	if h.features.IsEnabled(featuremgmt.FlagAccessTokenExpirationCheck) {
		// Check whether the logged in User has a token (whether the User used an OAuth provider to login)
		oauthToken, exists, _ := h.oauthTokenService.HasOAuthEntry(ctx, queryResult)
		if exists {
			if h.hasAccessTokenExpired(oauthToken) {
				reqContext.Logger.Info("access token expired", "userId", query.UserID, "expiry", fmt.Sprintf("%v", oauthToken.OAuthExpiry))

				// If the User doesn't have a refresh_token or refreshing the token was unsuccessful then log out the User and invalidate the OAuth tokens
				if err = h.oauthTokenService.TryTokenRefresh(ctx, oauthToken); err != nil {
					if !errors.Is(err, oauthtoken.ErrNoRefreshTokenFound) {
						reqContext.Logger.Error("could not fetch a new access token", "userId", oauthToken.UserId, "error", err)
					}

					reqContext.Resp.Before(h.deleteInvalidCookieEndOfRequestFunc(reqContext))
					if err = h.oauthTokenService.InvalidateOAuthTokens(ctx, oauthToken); err != nil {
						reqContext.Logger.Error("could not invalidate OAuth tokens", "userId", oauthToken.UserId, "error", err)
					}

					err = h.AuthTokenService.RevokeToken(ctx, token, false)
					if err != nil && !errors.Is(err, auth.ErrUserTokenNotFound) {
						reqContext.Logger.Error("failed to revoke auth token", "error", err)
					}
					return false
				}
			}
		}
	}

	reqContext.SignedInUser = queryResult
	reqContext.IsSignedIn = true
	reqContext.UserToken = token

	// Rotate the token just before we write response headers to ensure there is no delay between
	// the new token being generated and the client receiving it.
	reqContext.Resp.Before(h.rotateEndOfRequestFunc(reqContext))

	return true
}

func (h *ContextHandler) deleteInvalidCookieEndOfRequestFunc(reqContext *contextmodel.ReqContext) web.BeforeFunc {
	return func(w web.ResponseWriter) {
		if w.Written() {
			reqContext.Logger.Debug("Response written, skipping invalid cookie delete")
			return
		}

		reqContext.Logger.Debug("Expiring invalid cookie")
		cookies.DeleteCookie(reqContext.Resp, h.Cfg.LoginCookieName, nil)
	}
}

func (h *ContextHandler) rotateEndOfRequestFunc(reqContext *contextmodel.ReqContext) web.BeforeFunc {
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

		// if there is no user token attached to reqContext, skip.
		if reqContext.UserToken == nil {
			return
		}

		ctx, span := h.tracer.Start(reqContext.Req.Context(), "rotateEndOfRequestFunc")
		defer span.End()

		addr := reqContext.RemoteAddr()
		ip, err := network.GetIPFromAddress(addr)
		if err != nil {
			reqContext.Logger.Debug("Failed to get client IP address", "addr", addr, "err", err)
			ip = nil
		}

		rotated, newToken, err := h.AuthTokenService.TryRotateToken(ctx, reqContext.UserToken, ip, reqContext.Req.UserAgent())
		if err != nil {
			reqContext.Logger.Error("Failed to rotate token", "error", err)
			return
		}

		if rotated {
			reqContext.UserToken = newToken
			cookies.WriteSessionCookie(reqContext, h.Cfg, newToken.UnhashedToken, h.Cfg.LoginMaxLifetime)
		}
	}
}

func (h *ContextHandler) initContextWithRenderAuth(reqContext *contextmodel.ReqContext) bool {
	key := reqContext.GetCookie("renderKey")
	if key == "" {
		return false
	}

	ctx, span := h.tracer.Start(reqContext.Req.Context(), "initContextWithRenderAuth")
	defer span.End()

	renderUser, exists := h.RenderService.GetRenderUser(reqContext.Req.Context(), key)
	if !exists {
		reqContext.JsonApiErr(401, "Invalid Render Key", nil)
		return true
	}

	reqContext.SignedInUser = &user.SignedInUser{
		OrgID:   renderUser.OrgID,
		UserID:  renderUser.UserID,
		OrgRole: org.RoleType(renderUser.OrgRole),
	}

	// UserID can be 0 for background tasks and, in this case, there is no user info to retrieve
	if renderUser.UserID != 0 {
		query := user.GetSignedInUserQuery{UserID: renderUser.UserID, OrgID: renderUser.OrgID}
		queryResult, err := h.userService.GetSignedInUserWithCacheCtx(ctx, &query)
		if err == nil {
			reqContext.SignedInUser = queryResult
		}
	}

	reqContext.IsSignedIn = true
	reqContext.IsRenderCall = true
	reqContext.LastSeenAt = time.Now()
	return true
}

func logUserIn(reqContext *contextmodel.ReqContext, auth *authproxy.AuthProxy, username string, logger log.Logger, ignoreCache bool) (int64, error) {
	logger.Debug("Trying to log user in", "username", username, "ignoreCache", ignoreCache)
	// Try to log in user via various providers
	id, err := auth.Login(reqContext, ignoreCache)
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

func (h *ContextHandler) handleError(ctx *contextmodel.ReqContext, err error, statusCode int, cb func(error)) {
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

func (h *ContextHandler) initContextWithAuthProxy(reqContext *contextmodel.ReqContext, orgID int64) bool {
	username := reqContext.Req.Header.Get(h.Cfg.AuthProxyHeaderName)

	logger := log.New("auth.proxy")

	// Bail if auth proxy is not enabled
	if !h.authProxy.IsEnabled() {
		return false
	}

	// If there is no header - we can't move forward
	if !h.authProxy.HasHeader(reqContext) {
		return false
	}

	_, span := h.tracer.Start(reqContext.Req.Context(), "initContextWithAuthProxy")
	defer span.End()

	// Check if allowed continuing with this IP
	if err := h.authProxy.IsAllowedIP(reqContext.Req.RemoteAddr); err != nil {
		h.handleError(reqContext, err, 407, func(details error) {
			logger.Error("Failed to check whitelisted IP addresses", "message", err.Error(), "error", details)
		})
		return true
	}

	id, err := logUserIn(reqContext, h.authProxy, username, logger, false)
	if err != nil {
		h.handleError(reqContext, err, 407, nil)
		return true
	}

	logger.Debug("Got user ID, getting full user info", "userID", id)

	user, err := h.authProxy.GetSignedInUser(id, orgID)
	if err != nil {
		// The reason we couldn't find the user corresponding to the ID might be that the ID was found from a stale
		// cache entry. For example, if a user is deleted via the API, corresponding cache entries aren't invalidated
		// because cache keys are computed from request header values and not just the user ID. Meaning that
		// we can't easily derive cache keys to invalidate when deleting a user. To work around this, we try to
		// log the user in again without the cache.
		logger.Debug("Failed to get user info given ID, retrying without cache", "userID", id)
		if err := h.authProxy.RemoveUserFromCache(reqContext); err != nil {
			if !errors.Is(err, remotecache.ErrCacheItemNotFound) {
				logger.Error("Got unexpected error when removing user from auth cache", "error", err)
			}
		}
		id, err = logUserIn(reqContext, h.authProxy, username, logger, true)
		if err != nil {
			h.handleError(reqContext, err, 407, nil)
			return true
		}

		user, err = h.authProxy.GetSignedInUser(id, orgID)
		if err != nil {
			h.handleError(reqContext, err, 407, nil)
			return true
		}
	}

	logger.Debug("Successfully got user info", "userID", user.UserID, "username", user.Login)

	ctx := WithAuthHTTPHeader(reqContext.Req.Context(), h.Cfg.AuthProxyHeaderName)
	for _, header := range h.Cfg.AuthProxyHeaders {
		if header != "" {
			ctx = WithAuthHTTPHeader(ctx, header)
		}
	}

	*reqContext.Req = *reqContext.Req.WithContext(ctx)

	// Add user info to context
	reqContext.SignedInUser = user
	reqContext.IsSignedIn = true

	// Remember user data in cache
	if err := h.authProxy.Remember(reqContext, id); err != nil {
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

type authHTTPHeaderListContextKey struct{}

var authHTTPHeaderListKey = authHTTPHeaderListContextKey{}

// AuthHTTPHeaderList used to record HTTP headers that being when verifying authentication
// of an incoming HTTP request.
type AuthHTTPHeaderList struct {
	Items []string
}

// WithAuthHTTPHeader returns a copy of parent in which the named HTTP header will be included
// and later retrievable by AuthHTTPHeaderListFromContext.
func WithAuthHTTPHeader(parent context.Context, name string) context.Context {
	list := AuthHTTPHeaderListFromContext(parent)

	if list == nil {
		list = &AuthHTTPHeaderList{
			Items: []string{},
		}
	}

	list.Items = append(list.Items, name)

	return context.WithValue(parent, authHTTPHeaderListKey, list)
}

// AuthHTTPHeaderListFromContext returns the AuthHTTPHeaderList in a context.Context, if any,
// and will include any HTTP headers used when verifying authentication of an incoming HTTP request.
func AuthHTTPHeaderListFromContext(c context.Context) *AuthHTTPHeaderList {
	if list, ok := c.Value(authHTTPHeaderListKey).(*AuthHTTPHeaderList); ok {
		return list
	}
	return nil
}

func (h *ContextHandler) hasAccessTokenExpired(token *login.UserAuth) bool {
	if token.OAuthExpiry.IsZero() {
		return false
	}

	getTime := h.GetTime
	if getTime == nil {
		getTime = time.Now
	}

	return token.OAuthExpiry.Round(0).Add(-oauthtoken.ExpiryDelta).Before(getTime())
}

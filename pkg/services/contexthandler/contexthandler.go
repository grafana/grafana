// Package contexthandler contains the ContextHandler service.
package contexthandler

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func ProvideService(cfg *setting.Cfg, tracer tracing.Tracer, features *featuremgmt.FeatureManager, authnService authn.Service,
) *ContextHandler {
	return &ContextHandler{
		Cfg:          cfg,
		tracer:       tracer,
		features:     features,
		authnService: authnService,
	}
}

// ContextHandler is a middleware.
type ContextHandler struct {
	Cfg          *setting.Cfg
	tracer       tracing.Tracer
	features     *featuremgmt.FeatureManager
	authnService authn.Service
}

type reqContextKey = ctxkey.Key

// FromContext returns the ReqContext value stored in a context.Context, if any.
func FromContext(c context.Context) *contextmodel.ReqContext {
	if reqCtx, ok := c.Value(reqContextKey{}).(*contextmodel.ReqContext); ok {
		return reqCtx
	}
	return nil
}

// CopyWithReqContext returns a copy of the parent context with a semi-shallow copy of the ReqContext as a value.
// The ReqContexts's *web.Context is deep copied so that headers are thread-safe; additional properties are shallow copied and should be treated as read-only.
func CopyWithReqContext(ctx context.Context) context.Context {
	origReqCtx := FromContext(ctx)
	if origReqCtx == nil {
		return ctx
	}

	webCtx := &web.Context{
		Req:  origReqCtx.Req.Clone(ctx),
		Resp: web.NewResponseWriter(origReqCtx.Req.Method, response.CreateNormalResponse(http.Header{}, []byte{}, 0)),
	}
	reqCtx := &contextmodel.ReqContext{
		Context:               webCtx,
		SignedInUser:          origReqCtx.SignedInUser,
		UserToken:             origReqCtx.UserToken,
		IsSignedIn:            origReqCtx.IsSignedIn,
		IsRenderCall:          origReqCtx.IsRenderCall,
		AllowAnonymous:        origReqCtx.AllowAnonymous,
		SkipDSCache:           origReqCtx.SkipDSCache,
		SkipQueryCache:        origReqCtx.SkipQueryCache,
		Logger:                origReqCtx.Logger,
		Error:                 origReqCtx.Error,
		RequestNonce:          origReqCtx.RequestNonce,
		IsPublicDashboardView: origReqCtx.IsPublicDashboardView,
		LookupTokenErr:        origReqCtx.LookupTokenErr,
	}
	return context.WithValue(ctx, reqContextKey{}, reqCtx)
}

// Middleware provides a middleware to initialize the request context.
func (h *ContextHandler) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		mContext := web.FromContext(ctx)
		_, span := h.tracer.Start(ctx, "Auth - Middleware")
		defer span.End()

		reqContext := &contextmodel.ReqContext{
			Context: mContext,
			SignedInUser: &user.SignedInUser{
				Permissions: map[int64]map[string][]string{},
			},
			IsSignedIn:     false,
			AllowAnonymous: false,
			SkipDSCache:    false,
			Logger:         log.New("context"),
		}

		// Inject ReqContext into http.Request.Context
		*r = *r.WithContext(context.WithValue(ctx, reqContextKey{}, reqContext))
		// store list of possible auth header in context
		*reqContext.Req = *reqContext.Req.WithContext(WithAuthHTTPHeaders(reqContext.Req.Context(), h.Cfg))

		traceID := tracing.TraceIDFromContext(mContext.Req.Context(), false)
		if traceID != "" {
			reqContext.Logger = reqContext.Logger.New("traceID", traceID)
		}

		identity, err := h.authnService.Authenticate(ctx, &authn.Request{HTTPRequest: reqContext.Req, Resp: reqContext.Resp})
		if err != nil {
			if errors.Is(err, auth.ErrInvalidSessionToken) || errors.Is(err, authn.ErrExpiredAccessToken) {
				// Burn the cookie in case of invalid, expired or missing token
				reqContext.Resp.Before(h.deleteInvalidCookieEndOfRequestFunc(reqContext))
			}

			// Hack: set all errors on LookupTokenErr, so we can check it in auth middlewares
			reqContext.LookupTokenErr = err
		} else {
			reqContext.SignedInUser = identity.SignedInUser()
			reqContext.UserToken = identity.SessionToken
			reqContext.IsSignedIn = !identity.IsAnonymous
			reqContext.AllowAnonymous = identity.IsAnonymous
			reqContext.IsRenderCall = identity.AuthenticatedBy == login.RenderModule
		}

		reqContext.Logger = reqContext.Logger.New("userId", reqContext.UserID, "orgId", reqContext.OrgID, "uname", reqContext.Login)
		span.AddEvents(
			[]string{"uname", "orgId", "userId"},
			[]tracing.EventValue{
				{Str: reqContext.Login},
				{Num: reqContext.OrgID},
				{Num: reqContext.UserID}},
		)

		next.ServeHTTP(w, r)
	})
}

func (h *ContextHandler) deleteInvalidCookieEndOfRequestFunc(reqContext *contextmodel.ReqContext) web.BeforeFunc {
	return func(w web.ResponseWriter) {
		if h.features.IsEnabled(featuremgmt.FlagClientTokenRotation) {
			return
		}

		if w.Written() {
			reqContext.Logger.Debug("Response written, skipping invalid cookie delete")
			return
		}

		reqContext.Logger.Debug("Expiring invalid cookie")
		authn.DeleteSessionCookie(reqContext.Resp, h.Cfg)
	}
}

type authHTTPHeaderListContextKey struct{}

var authHTTPHeaderListKey = authHTTPHeaderListContextKey{}

// AuthHTTPHeaderList used to record HTTP headers that being when verifying authentication
// of an incoming HTTP request.
type AuthHTTPHeaderList struct {
	Items []string
}

// WithAuthHTTPHeaders returns a new context in which all possible configured auth header will be included
// and later retrievable by AuthHTTPHeaderListFromContext.
func WithAuthHTTPHeaders(ctx context.Context, cfg *setting.Cfg) context.Context {
	list := AuthHTTPHeaderListFromContext(ctx)
	if list == nil {
		list = &AuthHTTPHeaderList{
			Items: []string{},
		}
	}

	// used by basic auth, api keys and potentially jwt auth
	list.Items = append(list.Items, "Authorization")

	// if jwt is enabled we add it to the list. We can ignore in case it is set to Authorization
	if cfg.JWTAuthEnabled && cfg.JWTAuthHeaderName != "" && cfg.JWTAuthHeaderName != "Authorization" {
		list.Items = append(list.Items, cfg.JWTAuthHeaderName)
	}

	// if auth proxy is enabled add the main proxy header and all configured headers
	if cfg.AuthProxyEnabled {
		list.Items = append(list.Items, cfg.AuthProxyHeaderName)
		for _, header := range cfg.AuthProxyHeaders {
			if header != "" {
				list.Items = append(list.Items, header)
			}
		}
	}

	return context.WithValue(ctx, authHTTPHeaderListKey, list)
}

// AuthHTTPHeaderListFromContext returns the AuthHTTPHeaderList in a context.Context, if any,
// and will include any HTTP headers used when verifying authentication of an incoming HTTP request.
func AuthHTTPHeaderListFromContext(c context.Context) *AuthHTTPHeaderList {
	if list, ok := c.Value(authHTTPHeaderListKey).(*AuthHTTPHeaderList); ok {
		return list
	}
	return nil
}

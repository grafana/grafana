// Package contexthandler contains the ContextHandler service.
package contexthandler

import (
	"context"
	"fmt"
	"net/http"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	claims "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"

	authnClients "github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/featuremgmt"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func ProvideService(cfg *setting.Cfg, authenticator authn.Authenticator, features featuremgmt.FeatureToggles,
) *ContextHandler {
	return &ContextHandler{
		cfg:           cfg,
		authenticator: authenticator,
		features:      features,
	}
}

// ContextHandler is a middleware.
type ContextHandler struct {
	cfg           *setting.Cfg
	authenticator authn.Authenticator
	features      featuremgmt.FeatureToggles
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
		Context:                    webCtx,
		SignedInUser:               origReqCtx.SignedInUser,
		UserToken:                  origReqCtx.UserToken,
		IsSignedIn:                 origReqCtx.IsSignedIn,
		IsRenderCall:               origReqCtx.IsRenderCall,
		AllowAnonymous:             origReqCtx.AllowAnonymous,
		SkipDSCache:                origReqCtx.SkipDSCache,
		SkipQueryCache:             origReqCtx.SkipQueryCache,
		Logger:                     origReqCtx.Logger,
		Error:                      origReqCtx.Error,
		RequestNonce:               origReqCtx.RequestNonce,
		PublicDashboardAccessToken: origReqCtx.PublicDashboardAccessToken,
		LookupTokenErr:             origReqCtx.LookupTokenErr,
	}
	return context.WithValue(ctx, reqContextKey{}, reqCtx)
}

// Middleware provides a middleware to initialize the request context.
func (h *ContextHandler) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		span := trace.SpanFromContext(ctx)
		ctx = h.setRequestContext(ctx)

		// Preserve the original span so the setRequestContext span doesn't get propagated as a parent of the rest of the request
		ctx = trace.ContextWithSpan(ctx, span)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (h *ContextHandler) setRequestContext(ctx context.Context) context.Context {
	ctx, span := tracing.Start(ctx, "ContextHandler.setRequestContext")
	defer span.End()

	reqContext := &contextmodel.ReqContext{
		Context: web.FromContext(ctx),
		SignedInUser: &user.SignedInUser{
			Permissions: map[int64]map[string][]string{},
		},
		IsSignedIn:                false,
		AllowAnonymous:            false,
		SkipDSCache:               false,
		Logger:                    log.New("context"),
		UseSessionStorageRedirect: h.features.IsEnabledGlobally(featuremgmt.FlagUseSessionStorageForRedirection),
	}

	// inject ReqContext in the context
	ctx = context.WithValue(ctx, reqContextKey{}, reqContext)
	// store list of possible auth header in context
	ctx = WithAuthHTTPHeaders(ctx, h.cfg)
	// Set the context for the http.Request.Context
	// This modifies both r and reqContext.Req since they point to the same value
	*reqContext.Req = *reqContext.Req.WithContext(ctx)

	traceID := tracing.TraceIDFromContext(ctx, false)
	if traceID != "" {
		reqContext.Logger = reqContext.Logger.New("traceID", traceID)
	}

	id, err := h.authenticator.Authenticate(ctx, &authn.Request{HTTPRequest: reqContext.Req})
	if err != nil {
		// Hack: set all errors on LookupTokenErr, so we can check it in auth middlewares
		reqContext.LookupTokenErr = err
	} else {
		reqContext.SignedInUser = id.SignedInUser()
		reqContext.UserToken = id.SessionToken
		reqContext.IsSignedIn = !reqContext.IsAnonymous
		reqContext.AllowAnonymous = reqContext.IsAnonymous
		reqContext.IsRenderCall = id.IsAuthenticatedBy(login.RenderModule)
		ctx = identity.WithRequester(ctx, id)
	}

	h.excludeSensitiveHeadersFromRequest(reqContext.Req)

	reqContext.Logger = reqContext.Logger.New("userId", reqContext.UserID, "orgId", reqContext.OrgID, "uname", reqContext.Login)
	span.AddEvent("user", trace.WithAttributes(
		attribute.String("uname", reqContext.Login),
		attribute.Int64("orgId", reqContext.OrgID),
		attribute.Int64("userId", reqContext.UserID),
	))

	if h.cfg.IDResponseHeaderEnabled && reqContext.SignedInUser != nil {
		reqContext.Resp.Before(h.addIDHeaderEndOfRequestFunc(reqContext.SignedInUser))
	}

	// Set open feature evaluation context with namespace
	ns := "default"
	if id != nil {
		ns = id.Namespace
	}
	evalCtx := openfeature.NewEvaluationContext(ns, map[string]any{
		"namespace": ns,
	})
	ctx = openfeature.MergeTransactionContext(ctx, evalCtx)

	return ctx
}

func (h *ContextHandler) excludeSensitiveHeadersFromRequest(req *http.Request) {
	req.Header.Del(authnClients.ExtJWTAuthenticationHeaderName)
	req.Header.Del(authnClients.ExtJWTAuthorizationHeaderName)
}

func (h *ContextHandler) addIDHeaderEndOfRequestFunc(ident identity.Requester) web.BeforeFunc {
	return func(w web.ResponseWriter) {
		if w.Written() {
			return
		}

		id, _ := ident.GetInternalID()
		if !ident.IsIdentityType(
			claims.TypeUser,
			claims.TypeServiceAccount,
			claims.TypeAPIKey,
		) || id == 0 {
			return
		}

		if _, ok := h.cfg.IDResponseHeaderNamespaces[string(ident.GetIdentityType())]; !ok {
			return
		}

		headerName := fmt.Sprintf("%s-Identity-Id", h.cfg.IDResponseHeaderPrefix)
		w.Header().Add(headerName, ident.GetID())
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

	// remove X-Grafana-Device-Id as it is only used for auth in authn clients.
	list.Items = append(list.Items, "X-Grafana-Device-Id")

	// if jwt is enabled we add it to the list. We can ignore in case it is set to Authorization
	if cfg.JWTAuth.Enabled && cfg.JWTAuth.HeaderName != "" && cfg.JWTAuth.HeaderName != "Authorization" {
		list.Items = append(list.Items, cfg.JWTAuth.HeaderName)
	}

	// if auth proxy is enabled add the main proxy header and all configured headers
	if cfg.AuthProxy.Enabled {
		list.Items = append(list.Items, cfg.AuthProxy.HeaderName)
		for _, header := range cfg.AuthProxy.Headers {
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

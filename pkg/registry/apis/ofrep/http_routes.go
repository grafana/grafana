package ofrep

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/attribute"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var _ builder.HTTPRouteRegistrar = (*APIBuilder)(nil)

// RegisterHTTPRoutes registers the /ofrep/v1/... routes on Grafana's HTTP router.
// Used when the features-apiserver runs embedded in Grafana.
// Identity is populated by Grafana's ContextHandler middleware (c.SignedInUser),
// which grafanaHTTPHandler injects into the request context before the handler runs.
// In standalone mode, RootHTTPHandler is used instead.
func (b *APIBuilder) RegisterHTTPRoutes(rr routing.RouteRegister) {
	rr.Group("/ofrep", func(r routing.RouteRegister) {
		r.Post("/v1/evaluate/flags", b.grafanaHTTPHandler(func(c *contextmodel.ReqContext) {
			b.rootAllFlagsHandler(c.Resp, c.Req)
		}))
		r.Post("/v1/evaluate/flags/:flagKey", b.grafanaHTTPHandler(func(c *contextmodel.ReqContext) {
			req := mux.SetURLVars(c.Req, map[string]string{
				"flagKey": web.Params(c.Req)[":flagKey"],
			})
			b.rootOneFlagHandler(c.Resp, req)
		}))
	})
}

// RootHTTPHandler registers the /ofrep/v1/... routes directly on the k8s NonGoRestfulMux.
// Used when the features-apiserver runs in standalone mode, where Grafana's HTTP router is
// unavailable. Identity is expected to be populated upstream by the k8s request handler chain
// before the request reaches the handler.
// In embedded mode, RegisterHTTPRoutes is used instead.
func (b *APIBuilder) RootHTTPHandler() (string, http.Handler) {
	r := mux.NewRouter()
	r.Methods(http.MethodPost).Path("/ofrep/v1/evaluate/flags").HandlerFunc(b.rootAllFlagsHandler)
	r.Methods(http.MethodPost).Path("/ofrep/v1/evaluate/flags/{flagKey}").HandlerFunc(b.rootOneFlagHandler)
	return "/ofrep/", r
}

// grafanaHTTPHandler wraps a ReqContext handler to set up the identity context
// from Grafana's signed-in user before calling the inner handler.
// We use IsSignedIn rather than SignedInUser != nil because Grafana always
// populates SignedInUser (even for unauthenticated requests) with a zero-value
// struct whose GetIdentityType() returns TypeEmpty, not TypeUnauthenticated.
// Injecting that would cause isAuthenticatedRequest to incorrectly return true.
func (b *APIBuilder) grafanaHTTPHandler(inner func(*contextmodel.ReqContext)) func(*contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		if c.IsSignedIn {
			ctx := identity.WithRequester(c.Req.Context(), c.SignedInUser)
			c.Req = c.Req.WithContext(ctx)
		}
		inner(c)
	}
}

func (b *APIBuilder) rootOneFlagHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.Start(r.Context(), "ofrep.handler.root.evalFlag")
	defer span.End()

	r = r.WithContext(ctx)

	flagKey := mux.Vars(r)["flagKey"]
	if flagKey == "" {
		_ = tracing.Errorf(span, "flagKey parameter is required")
		span.SetAttributes(semconv.HTTPStatusCode(http.StatusBadRequest))
		http.Error(w, "flagKey parameter is required", http.StatusBadRequest)
		return
	}

	span.SetAttributes(attribute.String("flag_key", flagKey))

	isAuthedReq := b.isAuthenticatedRequest(r)
	span.SetAttributes(attribute.Bool("authenticated", isAuthedReq))

	if !isAuthedReq && !isPublicFlag(flagKey) {
		_ = tracing.Errorf(span, "unauthorized to evaluate flag: %s", flagKey)
		span.SetAttributes(semconv.HTTPStatusCode(http.StatusUnauthorized))
		b.logger.Error("Unauthorized to evaluate flag", "flagKey", flagKey)
		http.Error(w, "unauthorized to evaluate flag", http.StatusUnauthorized)
		return
	}

	if b.providerType == setting.FeaturesServiceProviderType || b.providerType == setting.OFREPProviderType {
		evalCtx, err := b.readEvalContext(w, r)
		if err != nil {
			_ = tracing.Errorf(span, bodyReadFailureMsg)
			span.SetAttributes(semconv.HTTPStatusCode(http.StatusBadRequest))
			b.logger.Error(bodyReadFailureMsg, "error", err, "flag", flagKey)
			http.Error(w, bodyReadFailureMsg, http.StatusBadRequest)
			return
		}

		authNamespace, valid := b.validateNamespaceIfPresent(r, evalCtx)
		b.logger.Debug("validating namespace in rootOneFlagHandler", "authNamespace", authNamespace, "evalCtxNamespace", evalCtx.namespace, "valid", valid, "flag", flagKey)
		if !valid {
			_ = tracing.Errorf(span, namespaceMismatchMsg)
			span.SetAttributes(semconv.HTTPStatusCode(http.StatusUnauthorized))
			b.logger.Error(namespaceMismatchMsg, "authNamespace", authNamespace, "evalCtxNamespace", evalCtx.namespace, "slug", evalCtx.slug, "flag", flagKey)
			http.Error(w, namespaceMismatchMsg, http.StatusUnauthorized)
			return
		}
		b.proxyFlagReq(ctx, flagKey, isAuthedReq, w, r)
		return
	}

	b.evalFlagStatic(ctx, flagKey, w)
}

func (b *APIBuilder) rootAllFlagsHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.Start(r.Context(), "ofrep.handler.root.evalAllFlags")
	defer span.End()

	r = r.WithContext(ctx)

	isAuthedReq := b.isAuthenticatedRequest(r)
	span.SetAttributes(attribute.Bool("authenticated", isAuthedReq))

	if b.providerType == setting.FeaturesServiceProviderType || b.providerType == setting.OFREPProviderType {
		evalCtx, err := b.readEvalContext(w, r)
		if err != nil {
			_ = tracing.Errorf(span, bodyReadFailureMsg)
			span.SetAttributes(semconv.HTTPStatusCode(http.StatusBadRequest))
			b.logger.Error(bodyReadFailureMsg, "error", err)
			http.Error(w, bodyReadFailureMsg, http.StatusBadRequest)
			return
		}

		authNamespace, valid := b.validateNamespaceIfPresent(r, evalCtx)
		b.logger.Debug("validating namespace in rootAllFlagsHandler", "authNamespace", authNamespace, "evalCtxNamespace", evalCtx.namespace, "valid", valid)
		if !valid {
			_ = tracing.Errorf(span, namespaceMismatchMsg)
			span.SetAttributes(semconv.HTTPStatusCode(http.StatusUnauthorized))
			b.logger.Error(namespaceMismatchMsg, "authNamespace", authNamespace, "evalCtxNamespace", evalCtx.namespace, "slug", evalCtx.slug)
			http.Error(w, namespaceMismatchMsg, http.StatusUnauthorized)
			return
		}
		b.proxyAllFlagReq(ctx, isAuthedReq, w, r)
		return
	}

	b.evalAllFlagsStatic(ctx, isAuthedReq, w)
}

// validateNamespaceIfPresent checks if the namespace in the evaluation context matches the authenticated user's
// namespace, but only if the evaluation context includes a namespace. If no namespace is present in the body,
// validation is skipped and the request is considered valid. This is used for cluster-global routes where
// namespace is not part of the URL.
// Returns the resolved auth namespace and whether validation passed.
func (b *APIBuilder) validateNamespaceIfPresent(r *http.Request, evalCtx evalContext) (string, bool) {
	_, span := tracing.Start(r.Context(), "ofrep.validateNamespaceIfPresent")
	defer span.End()

	if evalCtx.namespace == "" {
		// No namespace in eval context -- nothing to validate
		span.SetAttributes(attribute.Bool("validation.success", true))
		return "", true
	}

	user, ok := types.AuthInfoFrom(r.Context())
	if !ok {
		// No auth info -- can't validate, but that's fine; unauthed requests are
		// gated on public flags by the caller
		span.SetAttributes(attribute.Bool("validation.success", true))
		return "", true
	}

	authNamespace := user.GetNamespace()
	if authNamespace == "" {
		// Unauthenticated user has no namespace -- skip validation
		span.SetAttributes(attribute.Bool("validation.success", true))
		return "", true
	}

	span.SetAttributes(
		attribute.String("auth_namespace", authNamespace),
		attribute.String("eval_ctx_namespace", evalCtx.namespace),
	)

	// Wildcard auth namespace grants cluster-wide access — valid for any specific namespace.
	valid := evalCtx.namespace == authNamespace || authNamespace == "*"
	span.SetAttributes(attribute.Bool("validation.success", valid))
	return authNamespace, valid
}

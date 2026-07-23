package ofrep

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"go.opentelemetry.io/otel/attribute"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
)

// RegisterHTTPRoutes mounts the OFREP evaluation endpoints on Grafana's HTTP router.
// They are exposed under two prefixes:
//   - /ofrep — the canonical path.
//   - /apis/features.grafana.app/v0alpha1/namespaces/:namespace/ofrep — a deprecated,
//     API-server-flavored path kept for backwards compatibility with existing clients
//     (e.g. the frontend OFREP web provider). It should be removed once clients migrate.
//
// Both prefixes serve the same handlers. Identity is populated by Grafana's ContextHandler
// middleware (c.SignedInUser); grafanaHTTPHandler injects it into the request context before
// the handler runs. The :namespace URL segment is ignored — the trusted namespace comes from
// the authenticated identity, not the client-supplied path.
func (b *APIBuilder) RegisterHTTPRoutes(rr routing.RouteRegister) {
	routes := func(r routing.RouteRegister) {
		r.Post("/v1/evaluate/flags", b.grafanaHTTPHandler(b.allFlagsHandler))
		r.Post("/v1/evaluate/flags/:flagKey", b.grafanaHTTPHandler(b.oneFlagHandler))
	}

	rr.Group("/ofrep", routes)
	rr.Group("/apis/features.grafana.app/v0alpha1/namespaces/:namespace/ofrep", routes)
}

// grafanaHTTPHandler adapts an OFREP http.HandlerFunc to Grafana's router. It injects the
// signed-in user into the request context so downstream namespace validation and proxying
// see the caller's identity, and copies Grafana's :flagKey and :namespace route params into
// gorilla/mux vars, which the handlers read via mux.Vars.
//
// We gate on IsSignedIn rather than SignedInUser != nil because Grafana always populates
// SignedInUser (even for anonymous requests) with a zero-value struct whose
// GetIdentityType() returns TypeEmpty, not TypeUnauthenticated. Injecting that would make
// isAuthenticatedRequest incorrectly return true and leak non-public flags.
func (b *APIBuilder) grafanaHTTPHandler(inner http.HandlerFunc) func(*contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		req := c.Req
		if c.IsSignedIn {
			req = req.WithContext(identity.WithRequester(req.Context(), c.SignedInUser))
		}
		vars := map[string]string{}
		if flagKey := web.Params(req)[":flagKey"]; flagKey != "" {
			vars["flagKey"] = flagKey
		}
		// The deprecated /apis/.../namespaces/:namespace/ofrep path carries the namespace
		// in the URL. Unauthenticated requests have no identity to derive it from, so we
		// forward the path namespace instead (see validateNamespace). The canonical /ofrep
		// path has no :namespace segment, so this is empty there.
		if namespace := web.Params(req)[":namespace"]; namespace != "" {
			vars["namespace"] = namespace
		}
		if len(vars) > 0 {
			req = mux.SetURLVars(req, vars)
		}
		inner(c.Resp, req)
	}
}

func (b *APIBuilder) oneFlagHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.Start(r.Context(), "ofrep.handler.evalFlag")
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

	if b.providerType == setting.FeaturesServiceProviderType || b.providerType == setting.OFREPProviderType {
		evalCtx, err := b.readEvalContext(w, r)
		if err != nil {
			_ = tracing.Errorf(span, bodyReadFailureMsg)
			span.SetAttributes(semconv.HTTPStatusCode(http.StatusBadRequest))
			b.logger.Error(bodyReadFailureMsg, "error", err, "flag", flagKey)
			http.Error(w, bodyReadFailureMsg, http.StatusBadRequest)
			return
		}

		authNamespace, valid := b.validateNamespace(r, evalCtx)
		if !valid {
			_ = tracing.Errorf(span, namespaceMismatchMsg)
			span.SetAttributes(semconv.HTTPStatusCode(http.StatusUnauthorized))
			b.logger.Error(namespaceMismatchMsg, "authNamespace", authNamespace, "evalCtxNamespace", evalCtx.namespace, "slug", evalCtx.slug, "flag", flagKey)
			http.Error(w, namespaceMismatchMsg, http.StatusUnauthorized)
			return
		}
		b.proxyFlagReq(ctx, flagKey, isAuthedReq, authNamespace, w, r)
		return
	}

	b.evalFlagStatic(ctx, flagKey, w)
}

func (b *APIBuilder) allFlagsHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.Start(r.Context(), "ofrep.handler.evalAllFlags")
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

		authNamespace, valid := b.validateNamespace(r, evalCtx)
		if !valid {
			_ = tracing.Errorf(span, namespaceMismatchMsg)
			span.SetAttributes(semconv.HTTPStatusCode(http.StatusUnauthorized))
			b.logger.Error(namespaceMismatchMsg, "authNamespace", authNamespace, "evalCtxNamespace", evalCtx.namespace, "slug", evalCtx.slug)
			http.Error(w, namespaceMismatchMsg, http.StatusUnauthorized)
			return
		}
		b.proxyAllFlagReq(ctx, isAuthedReq, authNamespace, w, r)
		return
	}

	b.evalAllFlagsStatic(ctx, w)
}

// validateNamespace resolves the namespace to forward upstream and cross-checks any
// namespace declared in the evaluation context against the caller's authenticated
// namespace. The authenticated namespace is the trusted source and is always what gets
// forwarded; the eval-context namespace is only a defense-in-depth check to reject a
// caller claiming a namespace other than their own. Returns the resolved auth namespace
// and whether validation passed.
func (b *APIBuilder) validateNamespace(r *http.Request, evalCtx evalContext) (string, bool) {
	_, span := tracing.Start(r.Context(), "ofrep.validateNamespace")
	defer span.End()

	authNamespace := ""
	if user, ok := types.AuthInfoFrom(r.Context()); ok {
		authNamespace = user.GetNamespace()
	}

	// An empty auth namespace means the request is unauthenticated (no identity was
	// injected upstream). On the deprecated /apis/.../namespaces/:namespace/ofrep path
	// the namespace still lives in the URL, so forward it upstream to keep the User-Agent
	// namespace-scoped — mirroring the apiserver's useNamespaceFromPath handling. This
	// does not authenticate the request; access stays gated to public flags downstream.
	if authNamespace == "" {
		pathNamespace := mux.Vars(r)["namespace"]
		span.SetAttributes(
			attribute.String("path_namespace", pathNamespace),
			attribute.String("eval_ctx_namespace", evalCtx.namespace),
		)
		// Reject a body claiming a namespace other than the one in the path.
		if pathNamespace != "" && evalCtx.namespace != "" && evalCtx.namespace != pathNamespace {
			span.SetAttributes(attribute.Bool("validation.success", false))
			return pathNamespace, false
		}
		span.SetAttributes(attribute.Bool("validation.success", true))
		return pathNamespace, true
	}

	span.SetAttributes(
		attribute.String("auth_namespace", authNamespace),
		attribute.String("eval_ctx_namespace", evalCtx.namespace),
	)

	// Only cross-check when both sides declare a namespace. A wildcard auth namespace
	// grants cluster-wide access and matches any specific namespace.
	if evalCtx.namespace == "" || authNamespace == "*" {
		span.SetAttributes(attribute.Bool("validation.success", true))
		return authNamespace, true
	}

	valid := evalCtx.namespace == authNamespace
	span.SetAttributes(attribute.Bool("validation.success", valid))
	return authNamespace, valid
}

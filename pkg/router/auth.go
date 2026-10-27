package router

import (
	"fmt"
	"net/http"

	"github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/codes"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// authenticate trusts Grafana middleware authentication and verifies tokens for standalone requests.
func (r *GrafanaRouter) authenticate(w http.ResponseWriter, req *http.Request) *http.Request {
	info, _ := identity.GetRequester(req.Context())
	if info != nil {
		return req
	}

	ctx, span := routerTracer().Start(routerTraceContext(req), "router.authenticate")
	defer span.End()

	var err error
	errorType := "authentication_failure"
	switch token := req.Header.Get("X-Access-Token"); {
	case token == "":
		err = apierrors.NewUnauthorized("missing access token header")
		errorType = "missing_token"
	case r.authn == nil:
		err = apierrors.NewUnauthorized("token authenticator is not configured")
	default:
		if requestAuth, ok := r.authn.(authn.RequestTokenAuthenticator); ok {
			info, err = requestAuth.AuthenticateTokenForRequest(ctx, token, req)
		} else {
			info, err = r.authn.AuthenticateToken(ctx, token)
		}
		if err == nil && info == nil {
			err = apierrors.NewUnauthorized("token has no requester")
		}
		if apierrors.IsUnauthorized(err) {
			errorType = "invalid_token"
		}
	}
	if err != nil {
		setRoute(req, routeUnauthenticated)
		span.SetAttributes(semconv.ErrorTypeKey.String(errorType))
		span.SetStatus(codes.Error, "")
		_ = errhttp.Write(ctx, err, w)
		return nil
	}

	// Not ctx: its span has ended, and must not parent the rest of the request.
	return req.WithContext(identity.WithRequester(req.Context(), info))
}

// authorizeNamespace refuses a request for ns, the namespace its path names,
// when its requester may not use it, before any backend or stack sees it: Grafana admins may name any
// namespace, and everyone else only their own, or any with "*". Backends
// still authorize everything else.
func authorizeNamespace(w http.ResponseWriter, req *http.Request, ns string) bool {
	if ns == "" {
		return true
	}

	ctx := req.Context()
	requester, err := identity.GetRequester(ctx)
	if err != nil || requester == nil {
		setRoute(req, routeUnauthenticated)
		_ = errhttp.Write(ctx, apierrors.NewUnauthorized("missing requester"), w)
		return false
	}

	if requester.GetIsGrafanaAdmin() || types.NamespaceMatches(requester.GetNamespace(), ns) {
		return true
	}
	setRoute(req, routeForbidden)
	_ = errhttp.Write(req.Context(), apierrors.NewForbidden(
		schema.GroupResource{}, "",
		fmt.Errorf("the requester's namespace is not %q", ns),
	), w)
	return false
}

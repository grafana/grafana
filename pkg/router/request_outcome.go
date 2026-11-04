package router

import (
	"context"
	"errors"
	"net"
	"net/http"

	"k8s.io/apiserver/pkg/endpoints/request"
)

// How the router dispatched a request, for the request metrics' route label.
const (
	routeBackend   = "backend"   // proxied to, or served by, the group's backend
	routeFallback  = "fallback"  // sent to the single-tenant fallback
	routeDiscovery = "discovery" // root discovery (/apis, /openapi/v3) and /apis/discovery, built by the router
	routeNotFound  = "not_found" // nothing in the router serves the path
	routeHidden    = "hidden"    // a group the caller may not see (visibility.go), with not_found's 404
	routeInvalid   = "invalid"   // rejected before routing, such as a non-canonical path

	routeUnauthenticated = "unauthenticated" // rejected because the caller did not authenticate
	routeForbidden       = "forbidden"       // rejected because the caller may not use the namespace in the path, or the status
)

// Why a request's backend failed, for grafana_router_backend_failures_total.
const (
	failureBreakerOpen      = "breaker_open"
	failureTimeout          = "timeout"
	failureTransport        = "transport"
	failureRedirectRejected = "redirect_rejected"
	failureOriginMismatch   = "stack_origin_mismatch"
	failureAuth             = "auth"
)

type requestOutcomeKey struct{}

// requestOutcome records how the router dispatched one request, the plugin
// that served it, and why its backend failed. The request metrics read it once
// the request is done.
type requestOutcome struct {
	route    string
	pluginID string
	failure  string
	// info is the request's info, parsed once by the request metrics for the
	// verb label and reused by the handler. nil when the request did not
	// parse, or was not instrumented.
	info *request.RequestInfo
}

// withoutRequestOutcome detaches ctx from its request's outcome, for the
// router's own sub-requests, which may run concurrently and must not be
// attributed to the request that caused them.
func withoutRequestOutcome(ctx context.Context) context.Context {
	return context.WithValue(ctx, requestOutcomeKey{}, (*requestOutcome)(nil))
}

func outcomeOf(req *http.Request) *requestOutcome {
	outcome, _ := req.Context().Value(requestOutcomeKey{}).(*requestOutcome)
	return outcome
}

func setRoute(req *http.Request, route string) {
	if outcome := outcomeOf(req); outcome != nil && outcome.route == "" {
		outcome.route = route
	}
}

func setFailure(req *http.Request, reason string) {
	setContextFailure(req.Context(), reason)
}

// setContextFailure is setFailure for code that has only the request's context,
// such as plugin clients.
func setContextFailure(ctx context.Context, reason string) {
	if outcome, _ := ctx.Value(requestOutcomeKey{}).(*requestOutcome); outcome != nil {
		outcome.failure = reason
	}
}

func setPluginID(req *http.Request, pluginID string) {
	if outcome := outcomeOf(req); outcome != nil {
		outcome.pluginID = pluginID
	}
}

// failureReason classifies a proxy failure. A request the caller abandoned
// is not the backend's failure and has no reason.
func failureReason(req *http.Request, err error) string {
	if callerGone(req.Context()) != nil {
		return ""
	}
	var netErr net.Error
	switch {
	case errors.Is(err, errBackendRedirect):
		return failureRedirectRejected
	case errors.Is(err, errStackOriginMismatch):
		return failureOriginMismatch
	case errors.As(err, &netErr) && netErr.Timeout():
		return failureTimeout
	default:
		return failureTransport
	}
}

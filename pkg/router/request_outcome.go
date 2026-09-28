package router

import (
	"context"
	"errors"
	"net"
	"net/http"
)

// How the router dispatched a request, for the request metrics' route label.
const (
	routeBackend   = "backend"   // proxied to, or served by, the group's backend
	routeFallback  = "fallback"  // sent to the single-tenant fallback
	routeDiscovery = "discovery" // root discovery (/apis, /openapi/v3), built by the router
	routeNext      = "next"      // not the router's; passed to the next handler
	routeInvalid   = "invalid"   // rejected before routing, such as a non-canonical path
)

// Why a request's backend failed, for grafana_router_backend_failures_total.
const (
	failureBreakerOpen      = "breaker_open"
	failureTimeout          = "timeout"
	failureTransport        = "transport"
	failureRedirectRejected = "redirect_rejected"
	failureOriginMismatch   = "stack_origin_mismatch"
)

type requestOutcomeKey struct{}

// requestOutcome records how the router dispatched one request and why its
// backend failed. The request metrics read it once the request is done.
type requestOutcome struct {
	route   string
	failure string
}

func withRequestOutcome(req *http.Request) (*http.Request, *requestOutcome) {
	outcome := &requestOutcome{}
	return req.WithContext(context.WithValue(req.Context(), requestOutcomeKey{}, outcome)), outcome
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
	if outcome := outcomeOf(req); outcome != nil {
		outcome.failure = reason
	}
}

// failureReason classifies a proxy failure. A request the caller abandoned
// is not the backend's failure and has no reason.
func failureReason(req *http.Request, err error) string {
	if req.Context().Err() != nil {
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

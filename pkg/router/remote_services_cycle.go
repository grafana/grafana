package router

import (
	"fmt"
	"net/http"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// remoteServicesOriginHeader marks a request that a cloud ST pod's remote
// services sent to MT, with the stack's namespace. MT may route a group back
// to the ST pods (the MT router's single-tenant fallback), and a group the ST
// pod sends to MT would then come back to it and go out again, forever. Both
// ends refuse a marked request that would close that cycle:
//
//   - The MT router's fallback refuses to send a marked request to an ST pod.
//     The remote services sign every request for their own stack, so the
//     fallback could only send it back where it came from.
//   - An ST pod's remote services refuse to send a request that arrived marked.
//     That covers an MT router without the check above.
//
// A caller that sets the header itself only fails its own request.
const remoteServicesOriginHeader = "Grafana-Remote-Services-Origin"

// upstreamTraceHeader carries the router's trace context to a remote service
// past the vanilla kube-apiserver in front of it, which drops traceparent. The
// MT services link to it (filters.WithExtractUpstreamTraceLink), as they did
// for the aggregator.
const upstreamTraceHeader = "Grafana-Upstream-Traceparent"

// remoteServiceHeaders is the remote services' outermost round tripper. It
// refuses a request that already went through an ST pod's remote services,
// before the signer exchanges a token for it, then marks the request with
// remoteServicesOriginHeader and upstreamTraceHeader. It runs inside the
// tracing transport, so the trace context is the outbound request's span.
type remoteServiceHeaders struct {
	stackNamespace string
	next           http.RoundTripper
}

func newRemoteServiceHeaders(stackNamespace string) func(http.RoundTripper) http.RoundTripper {
	return func(next http.RoundTripper) http.RoundTripper {
		return remoteServiceHeaders{stackNamespace: stackNamespace, next: next}
	}
}

func (h remoteServiceHeaders) RoundTrip(req *http.Request) (*http.Response, error) {
	if origin := req.Header.Get(remoteServicesOriginHeader); origin != "" {
		return nil, &localProxyError{
			status: remoteServicesCycle(fmt.Sprintf("the request already left %s's remote services; sending it again would loop", origin)),
			reason: failureLoop,
		}
	}
	out := req.Clone(req.Context())
	out.Header.Set(remoteServicesOriginHeader, h.stackNamespace)
	carrier := propagation.MapCarrier{}
	otel.GetTextMapPropagator().Inject(req.Context(), carrier)
	if tp := carrier.Get("traceparent"); tp != "" {
		out.Header.Set(upstreamTraceHeader, tp)
	}
	return h.next.RoundTrip(out)
}

// refuseRemoteServicesCycle answers a request that a cloud ST pod's remote
// services sent, so that the MT router's fallback never sends it back to an ST
// pod. It reports whether it answered.
func refuseRemoteServicesCycle(w http.ResponseWriter, req *http.Request) bool {
	origin := req.Header.Get(remoteServicesOriginHeader)
	if origin == "" {
		return false
	}
	setFailure(req, failureLoop)
	logging.FromContext(req.Context()).Warn("router: refused to send a stack's remote services request back to a single-tenant pod",
		"origin", origin, "path", req.URL.Path)
	_ = errhttp.Write(req.Context(), remoteServicesCycle(fmt.Sprintf("the request came from %s's remote services, and no multi-tenant backend serves it", origin)), w)
	return true
}

func remoteServicesCycle(message string) *apierrors.StatusError {
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusLoopDetected,
		Reason:  metav1.StatusReason("LoopDetected"),
		Message: message,
	}}
}

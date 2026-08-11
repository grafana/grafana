package filters

import (
	"context"
	"errors"
	"net/http"

	"k8s.io/apiserver/pkg/endpoints/responsewriter"
)

// statusClientClosedRequest is the non-standard status used to record a request
// the client abandoned before the server responded. Grafana already reports this
// case as 499 in the query API and in the aggregator proxy.
const statusClientClosedRequest = 499

// WithCanceledRequestStatus reports an abandoned request as 499 rather than 504.
//
// The apiserver's WithTimeoutForNonLongRunningRequests filter selects on
// req.Context().Done(), which fires on client cancellation as well as on deadline
// expiry, but reports either as a timeout: it writes 504 with a "request did not
// complete within the allotted timeout" body. When a browser abandons an in-flight
// request that misattributes a client disconnect to a server-side timeout, which
// surfaces as a status_source=server 5xx in request logs and error-rate panels.
//
// Only a 504 on a canceled context is rewritten, so genuine deadline expiry
// (context.DeadlineExceeded) still reports 504.
//
// This filter must be installed outside DefaultBuildHandlerChain so that it wraps
// the ResponseWriter the timeout filter writes to.
func WithCanceledRequestStatus(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		decorator := &canceledRequestWriter{ResponseWriter: w, req: req}
		handler.ServeHTTP(responsewriter.WrapForHTTP1Or2(decorator), req)
	})
}

type canceledRequestWriter struct {
	http.ResponseWriter
	req *http.Request
}

var _ responsewriter.UserProvidedDecorator = &canceledRequestWriter{}

func (w *canceledRequestWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func (w *canceledRequestWriter) WriteHeader(code int) {
	if code == http.StatusGatewayTimeout && errors.Is(w.req.Context().Err(), context.Canceled) {
		code = statusClientClosedRequest
	}
	w.ResponseWriter.WriteHeader(code)
}

package http

import (
	"net/http"
	"net/url"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/httpstream"
	"k8s.io/apimachinery/pkg/util/proxy"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	endpointmetrics "k8s.io/apiserver/pkg/endpoints/metrics"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	genericfeatures "k8s.io/apiserver/pkg/features"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	utilflowcontrol "k8s.io/apiserver/pkg/util/flowcontrol"
	apiserverproxyutil "k8s.io/apiserver/pkg/util/proxy"
	"k8s.io/client-go/transport"
	"k8s.io/component-base/tracing"
	"k8s.io/klog/v2"

	aggregationv0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	backendHandler "github.com/grafana/grafana/pkg/aggregator/apiserver/backend"
)

type HTTPHandler struct {
	proxyRoundTripper http.RoundTripper
	tracerProvider    tracing.TracerProvider
}

func NewHTTPHandler(
	tracerProvider tracing.TracerProvider,
	dataplaneService aggregationv0alpha1.DataPlaneService,
	delegate http.Handler,
) http.Handler {
	transportConfig := &transport.Config{
		TLS: transport.TLSConfig{
			Insecure: true,
		},
	}
	proxyRoundTripper, _ := transport.New(transportConfig)

	h := &HTTPHandler{
		tracerProvider:    tracerProvider,
		proxyRoundTripper: proxyRoundTripper,
	}

	return backendHandler.NewBackendHandler(h, delegate, dataplaneService)
}

func (h *HTTPHandler) handlerFor(location *url.URL) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		user, ok := genericapirequest.UserFrom(req.Context())
		if !ok {
			proxyError(w, req, "missing user", http.StatusInternalServerError)
			return
		}

		newReq, cancelFn := apiserverproxyutil.NewRequestForProxy(location, req)
		defer cancelFn()

		upgrade := httpstream.IsUpgradeRequest(req)

		var userUID string
		if utilfeature.DefaultFeatureGate.Enabled(genericfeatures.RemoteRequestHeaderUID) {
			userUID = user.GetUID()
		}

		proxyRoundTripper := h.proxyRoundTripper
		proxyRoundTripper = transport.NewAuthProxyRoundTripper(user.GetName(), userUID, user.GetGroups(), user.GetExtra(), proxyRoundTripper)

		if utilfeature.DefaultFeatureGate.Enabled(genericfeatures.APIServerTracing) && !upgrade {
			tracingWrapper := tracing.WrapperFor(h.tracerProvider)
			proxyRoundTripper = tracingWrapper(proxyRoundTripper)
		}

		// If we are upgrading, then the upgrade path tries to use this request with the TLS config we provide, but it does
		// NOT use the proxyRoundTripper.  It's a direct dial that bypasses the proxyRoundTripper.  This means that we have to
		// attach the "correct" user headers to the request ahead of time.
		if upgrade {
			transport.SetAuthProxyHeaders(newReq, user.GetName(), userUID, user.GetGroups(), user.GetExtra())
		}

		handler := proxy.NewUpgradeAwareHandler(location, proxyRoundTripper, true, upgrade, &responder{w: w})
		utilflowcontrol.RequestDelegated(req.Context())
		handler.ServeHTTP(w, newReq)
	})
}

// responder implements rest.Responder for assisting a connector in writing objects or errors.
type responder struct {
	w http.ResponseWriter
}

// TODO this should properly handle content type negotiation
// if the caller asked for protobuf and you write JSON bad things happen.
func (r *responder) Object(statusCode int, obj runtime.Object) {
	responsewriters.WriteRawJSON(statusCode, obj, r.w)
}

func (r *responder) Error(_ http.ResponseWriter, _ *http.Request, err error) {
	http.Error(r.w, err.Error(), http.StatusServiceUnavailable)
}

func proxyError(w http.ResponseWriter, req *http.Request, error string, code int) {
	http.Error(w, error, code)

	ctx := req.Context()
	info, ok := genericapirequest.RequestInfoFrom(ctx)
	if !ok {
		klog.Warning("no RequestInfo found in the context")
		return
	}
	// TODO: record long-running request differently? The long-running check func does not necessarily match the one of the aggregated apiserver
	endpointmetrics.RecordRequestTermination(req, info, "dataplane-aggregator-http", code)
}

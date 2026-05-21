// THIS FILE IS MOSTLY COPY/PASTA FROM k8s 
// PLEASE EDIT WITH GREAT CARE TO MINIMIZE FORK
// SEE COMMENTS BELOW FOR MORE DETAILS

package builder

import (
	"net/http"

	"k8s.io/apiserver/pkg/endpoints/filterlatency"
	genericapifilters "k8s.io/apiserver/pkg/endpoints/filters"
	"k8s.io/apiserver/pkg/endpoints/filters/impersonation"
	genericfeatures "k8s.io/apiserver/pkg/features"
	genericapiserver "k8s.io/apiserver/pkg/server"
	genericfilters "k8s.io/apiserver/pkg/server/filters"
	"k8s.io/apiserver/pkg/server/routine"
	flowcontrolrequest "k8s.io/apiserver/pkg/util/flowcontrol/request"
)

// CustomBuildHandlerChain is a Grafana-specific variant of k8s
// genericapiserver.DefaultBuildHandlerChain. It differs in three ways, all of
// which are deliberate:
//
//  1. It omits genericapifilters.WithTracing. k8s wraps the chain with
//     otelhttp configured as a public endpoint for non-system:privileged
//     callers, which severs the upstream trace context — every request gets a
//     fresh root span linked (not parented) to the caller. Our embedded
//     apiservers only receive requests from trusted internal services, 
// 	   and the outer WithTracing in GetDefaultBuildHandlerChainFunc already 
//     creates the KubernetesAPI span with proper parent-child propagation.
//
//  2. It omits the WithRetryAfter and WithWatchTerminationDuringShutdown
//     filters as these filteres depend on an unexported Config.lifecycleSignals
//     field. Both are gated upstream on Config fields (ShutdownSendRetryAfter, 
//     ShutdownWatchTerminationGracePeriod) that Grafana never sets, 
//     so the filters were dead code. Dropping them lets us avoid reflection
//     + unsafe.Pointer to reach into k8s internals.
//
//  3. It omits WithMuxAndDiscoveryComplete. That filter exists upstream to
//     keep k8s GC/namespace controllers from acting on stray 404s during
//     mux installation. Grafana apiservers are not consulted by those
//     controllers, so the protection is unnecessary. Same lifecycleSignals
//     reasoning as above.
//
// Maintenance: when bumping k8s, diff genericapiserver.DefaultBuildHandlerChain
// (k8s.io/apiserver/pkg/server/config.go) against this function and reconcile
// any new filters that appear.
func CustomBuildHandlerChain(apiHandler http.Handler, c *genericapiserver.Config) http.Handler {
	handler := apiHandler

	handler = filterlatency.TrackCompleted(handler)
	handler = genericapifilters.WithAuthorization(handler, c.Authorization.Authorizer, c.Serializer)
	handler = filterlatency.TrackStarted(handler, c.TracerProvider, "authorization")

	if c.FlowControl != nil {
		workEstimatorCfg := flowcontrolrequest.DefaultWorkEstimatorConfig()
		requestWorkEstimator := flowcontrolrequest.NewWorkEstimator(
			c.StorageObjectCountTracker.Get, c.FlowControl.GetInterestedWatchCount, workEstimatorCfg, c.FlowControl.GetMaxSeats)
		handler = filterlatency.TrackCompleted(handler)
		handler = genericfilters.WithPriorityAndFairness(handler, c.LongRunningFunc, c.FlowControl, requestWorkEstimator, c.RequestTimeout/4)
		handler = filterlatency.TrackStarted(handler, c.TracerProvider, "priorityandfairness")
	} else {
		handler = genericfilters.WithMaxInFlightLimit(handler, c.MaxRequestsInFlight, c.MaxMutatingRequestsInFlight, c.LongRunningFunc)
	}

	handler = filterlatency.TrackCompleted(handler)
	if c.FeatureGate.Enabled(genericfeatures.ConstrainedImpersonation) {
		handler = impersonation.WithConstrainedImpersonation(handler, c.Authorization.Authorizer, c.Serializer)
		handler = filterlatency.TrackStarted(handler, c.TracerProvider, "constrainedimpersonation")
	} else {
		handler = impersonation.WithImpersonation(handler, c.Authorization.Authorizer, c.Serializer)
		handler = filterlatency.TrackStarted(handler, c.TracerProvider, "impersonation")
	}

	handler = filterlatency.TrackCompleted(handler)
	handler = genericapifilters.WithAudit(handler, c.AuditBackend, c.AuditPolicyRuleEvaluator, c.LongRunningFunc)
	handler = filterlatency.TrackStarted(handler, c.TracerProvider, "audit")

	failedHandler := genericapifilters.Unauthorized(c.Serializer)
	failedHandler = genericapifilters.WithFailedAuthenticationAudit(failedHandler, c.AuditBackend, c.AuditPolicyRuleEvaluator)

	// OMITTED: genericapifilters.WithTracing — see function header (1).

	failedHandler = filterlatency.TrackCompleted(failedHandler)
	handler = filterlatency.TrackCompleted(handler)
	handler = genericapifilters.WithAuthentication(handler, c.Authentication.Authenticator, failedHandler, c.Authentication.APIAudiences, c.Authentication.RequestHeaderConfig)
	handler = filterlatency.TrackStarted(handler, c.TracerProvider, "authentication")

	handler = genericfilters.WithCORS(handler, c.CorsAllowedOriginList, nil, nil, nil, "true")

	handler = genericapifilters.WithWarningRecorder(handler)

	handler = genericfilters.WithTimeoutForNonLongRunningRequests(handler, c.LongRunningFunc)

	handler = genericapifilters.WithRequestDeadline(handler, c.AuditBackend, c.AuditPolicyRuleEvaluator,
		c.LongRunningFunc, c.Serializer, c.RequestTimeout)
	handler = genericfilters.WithWaitGroup(handler, c.LongRunningFunc, c.NonLongRunningRequestWaitGroup)
	// OMITTED: genericfilters.WithWatchTerminationDuringShutdown — see function header (2).
	if c.SecureServing != nil && !c.SecureServing.DisableHTTP2 && c.GoawayChance > 0 {
		handler = genericfilters.WithProbabilisticGoaway(handler, c.GoawayChance)
	}
	handler = genericapifilters.WithCacheControl(handler)
	handler = genericfilters.WithHSTS(handler, c.HSTSDirectives)
	// OMITTED: genericfilters.WithRetryAfter — see function header (2).
	handler = genericfilters.WithHTTPLogging(handler)
	handler = genericapifilters.WithLatencyTrackers(handler)
	if c.FeatureGate.Enabled(genericfeatures.APIServingWithRoutine) {
		handler = routine.WithRoutine(handler, c.LongRunningFunc)
	}
	handler = genericapifilters.WithRequestInfo(handler, c.RequestInfoResolver)
	handler = genericapifilters.WithRequestReceivedTimestamp(handler)
	// OMITTED: genericapifilters.WithMuxAndDiscoveryComplete — see function header (3).
	handler = genericfilters.WithPanicRecovery(handler, c.RequestInfoResolver)
	handler = genericapifilters.WithAuditInit(handler)
	return handler
}

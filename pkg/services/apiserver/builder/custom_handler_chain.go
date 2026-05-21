package builder

import (
	"net/http"
	"reflect"
	"unsafe"

	"k8s.io/apiserver/pkg/endpoints/filterlatency"
	genericapifilters "k8s.io/apiserver/pkg/endpoints/filters"
	"k8s.io/apiserver/pkg/endpoints/filters/impersonation"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"
	genericfeatures "k8s.io/apiserver/pkg/features"
	genericapiserver "k8s.io/apiserver/pkg/server"
	genericfilters "k8s.io/apiserver/pkg/server/filters"
	"k8s.io/apiserver/pkg/server/routine"
	flowcontrolrequest "k8s.io/apiserver/pkg/util/flowcontrol/request"
)

// CustomBuildHandlerChain mirrors k8s genericapiserver.DefaultBuildHandlerChain
// verbatim except it omits the genericapifilters.WithTracing call.
//
// Why we omit it: k8s's WithTracing wraps the handler with otelhttp configured
// as a public endpoint for non-system:privileged callers. That severs the
// upstream trace context — every request gets a fresh root span linked
// (rather than parented) to the caller. Our embedded apiservers only receive
// requests from trusted internal services (ST grafana, grafana-ruler, etc.),
// so the public-endpoint defense is unnecessary, and our outer WithTracing
// in GetDefaultBuildHandlerChainFunc already creates the KubernetesAPI span
// with proper parent-child propagation.
//
// Maintenance note: this function is a structural copy of
// k8s.io/apiserver/pkg/server/config.go's DefaultBuildHandlerChain. When
// bumping k8s, diff that function against this one and reconcile new filters.
// custom_handler_chain_test.go runs reflection-based assertions that catch
// silent drift in the lifecycleSignals private-field shape.
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

	// OMITTED: genericapifilters.WithTracing — see file header comment.

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
	if c.ShutdownWatchTerminationGracePeriod > 0 {
		handler = genericfilters.WithWatchTerminationDuringShutdown(handler, shutdownSignalFromConfig(c), c.WatchRequestWaitGroup)
	}
	if c.SecureServing != nil && !c.SecureServing.DisableHTTP2 && c.GoawayChance > 0 {
		handler = genericfilters.WithProbabilisticGoaway(handler, c.GoawayChance)
	}
	handler = genericapifilters.WithCacheControl(handler)
	handler = genericfilters.WithHSTS(handler, c.HSTSDirectives)
	if c.ShutdownSendRetryAfter {
		handler = genericfilters.WithRetryAfter(handler, lifecycleSignalCh(c, "NotAcceptingNewRequest"))
	}
	handler = genericfilters.WithHTTPLogging(handler)
	handler = genericapifilters.WithLatencyTrackers(handler)
	if c.FeatureGate.Enabled(genericfeatures.APIServingWithRoutine) {
		handler = routine.WithRoutine(handler, c.LongRunningFunc)
	}
	handler = genericapifilters.WithRequestInfo(handler, c.RequestInfoResolver)
	handler = genericapifilters.WithRequestReceivedTimestamp(handler)
	handler = genericapifilters.WithMuxAndDiscoveryComplete(handler, lifecycleSignalCh(c, "MuxAndDiscoveryComplete"))
	handler = genericfilters.WithPanicRecovery(handler, c.RequestInfoResolver)
	handler = genericapifilters.WithAuditInit(handler)
	return handler
}

// lifecycleSignalsValue returns the (unexported) lifecycleSignals field on
// the Config, made addressable via the unsafe pointer trick so its methods
// and exported subfields can be reached through reflection. Drift in the
// upstream field name is caught by TestLifecycleSignalsAccessible.
func lifecycleSignalsValue(c *genericapiserver.Config) reflect.Value {
	field := reflect.ValueOf(c).Elem().FieldByName("lifecycleSignals")
	return reflect.NewAt(field.Type(), unsafe.Pointer(field.UnsafeAddr())).Elem()
}

// shutdownSignalFromConfig returns lifecycleSignals as an apirequest.ServerShutdownSignal.
// lifecycleSignals implements that interface upstream; we exploit that to pass it
// to filters that take the exported interface type.
func shutdownSignalFromConfig(c *genericapiserver.Config) apirequest.ServerShutdownSignal {
	return lifecycleSignalsValue(c).Interface().(apirequest.ServerShutdownSignal)
}

// lifecycleSignalCh extracts a named signal channel from lifecycleSignals.
// The named subfield is an unexported lifecycleSignal type with a Signaled()
// method that returns <-chan struct{}.
func lifecycleSignalCh(c *genericapiserver.Config, fieldName string) <-chan struct{} {
	sub := lifecycleSignalsValue(c).FieldByName(fieldName)
	sub = reflect.NewAt(sub.Type(), unsafe.Pointer(sub.UnsafeAddr())).Elem()
	out := sub.MethodByName("Signaled").Call(nil)
	return out[0].Interface().(<-chan struct{})
}

package v3

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"slices"
	"sync/atomic"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	clientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/plugins"
)

// Values of the target label.
const (
	TargetLocal  = "local"  // a plugin process Grafana runs
	TargetRemote = "remote" // a plugin deployment reached over the network
)

// Values of the endpoint label.
const (
	EndpointCallRoute       = "callRoute"
	EndpointAdmissionReview = "admissionReview"
	EndpointConvertObjects  = "convertObjects"
)

// Result is the outcome of one plugin call, for the result label. Results are
// chosen for availability SLOs: client_error means the plugin worked and
// rejected the request, and canceled means the caller went away.
type Result string

const (
	ResultOK          Result = "ok"
	ResultClientError Result = "client_error"
	ResultServerError Result = "server_error"
	ResultUnavailable Result = "unavailable"
	ResultTimeout     Result = "timeout"
	ResultCanceled    Result = "canceled"
)

// unknownGroupLabel replaces groups the plugin does not serve, so callers
// cannot create new series.
const unknownGroupLabel = "unknown"

// Metrics instruments calls to plugin v3 clients. They are separate from the
// grafana_plugin_request_* metrics, whose statuses count a timeout as
// cancelled and any HTTP 4xx as an error, which makes them unsuitable for SLOs.
// Create one Metrics per registerer and share it between clients.
type Metrics struct {
	requests *prometheus.CounterVec
	duration *prometheus.HistogramVec
}

func NewMetrics(reg prometheus.Registerer) *Metrics {
	labels := []string{"plugin_id", "group", "endpoint", "target", "result"}
	m := &Metrics{
		requests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "plugin_v3",
			Name:      "requests_total",
			Help:      "Plugin v3 calls, by plugin, API group, endpoint, target (local or remote) and result (ok, client_error, server_error, unavailable, timeout or canceled).",
		}, labels),
		duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "grafana",
			Subsystem:                       "plugin_v3",
			Name:                            "request_duration_seconds",
			Help:                            "Latency of plugin v3 calls until their first response, by plugin, API group, endpoint, target and result.",
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, labels),
	}
	reg.MustRegister(m.requests, m.duration)
	return m
}

// InstrumentOptions identify the plugin behind an instrumented client.
type InstrumentOptions struct {
	PluginID string
	// Target is TargetLocal or TargetRemote.
	Target string
	// Groups are the API groups the plugin serves. A call for any other group
	// is recorded with the group "unknown".
	Groups []string
}

// Instrument returns client with metrics for every call. A nil client stays nil.
func (m *Metrics) Instrument(client clientv3.Client, opts InstrumentOptions) clientv3.Client {
	if m == nil || client == nil {
		return client
	}
	return &instrumentedClient{Client: client, metrics: m, opts: opts}
}

type instrumentedClient struct {
	clientv3.Client
	metrics *Metrics
	opts    InstrumentOptions
}

func (c *instrumentedClient) AdmissionReview(ctx context.Context, req *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	done := c.start(ctx, EndpointAdmissionReview, req.GetKind().GetGroup())
	defer done.onPanic()
	res, err := c.Client.AdmissionReview(ctx, req)
	if err == nil && res.GetError() != nil {
		// A denial without a code is the plugin rejecting the object.
		done.finish(StatusCodeResult(int(res.GetError().GetCode()), ResultClientError))
		return res, err
	}
	done.finish(ErrorResult(ctx, err))
	return res, err
}

func (c *instrumentedClient) ConvertObjects(ctx context.Context, req *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	done := c.start(ctx, EndpointConvertObjects, req.GetApi().GetGroup())
	defer done.onPanic()
	res, err := c.Client.ConvertObjects(ctx, req)
	if err == nil && res.GetError() != nil {
		// Objects the plugin stored are its own to convert, so a failure
		// without a code is the plugin's.
		done.finish(StatusCodeResult(int(res.GetError().GetCode()), ResultServerError))
		return res, err
	}
	done.finish(ErrorResult(ctx, err))
	return res, err
}

// CallRoute records the call when its first response arrives, so a long
// response stream does not count towards the latency.
func (c *instrumentedClient) CallRoute(ctx context.Context, req *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	done := c.start(ctx, EndpointCallRoute, req.GetGroup())
	defer done.onPanic()
	stream, err := c.Client.CallRoute(ctx, req)
	if err != nil {
		done.finish(ErrorResult(ctx, err))
		return stream, err
	}
	// A caller may abandon the stream without receiving a response.
	stop := context.AfterFunc(ctx, func() { done.finish(ErrorResult(ctx, ctx.Err())) })
	return &instrumentedRouteStream{ServerStreamingClient: stream, done: done, stop: stop}, nil
}

type instrumentedRouteStream struct {
	grpc.ServerStreamingClient[pluginv3.CallRouteResponse]
	done *callRecorder
	stop func() bool
}

func (s *instrumentedRouteStream) Recv() (*pluginv3.CallRouteResponse, error) {
	defer s.done.onPanic()
	res, err := s.ServerStreamingClient.Recv()
	if s.done.recorded.Load() {
		return res, err
	}
	s.stop()
	switch {
	case err == nil:
		s.done.finish(StatusCodeResult(int(res.GetCode()), ResultOK))
	case errors.Is(err, io.EOF):
		// The stream ended without a response.
		s.done.finish(ResultServerError)
	default:
		s.done.finish(ErrorResult(s.done.ctx, err))
	}
	return res, err
}

func (c *instrumentedClient) start(ctx context.Context, endpoint, group string) *callRecorder {
	if !slices.Contains(c.opts.Groups, group) {
		group = unknownGroupLabel
	}
	return &callRecorder{
		ctx:     ctx,
		metrics: c.metrics,
		labels:  []string{c.opts.PluginID, group, endpoint, c.opts.Target},
		start:   time.Now(),
	}
}

// callRecorder records one call exactly once, whichever of its result, a
// panic or the caller's cancellation comes first.
type callRecorder struct {
	ctx      context.Context
	metrics  *Metrics
	labels   []string
	start    time.Time
	recorded atomic.Bool
}

func (r *callRecorder) finish(result Result) {
	if !r.recorded.CompareAndSwap(false, true) {
		return
	}
	elapsed := time.Since(r.start)
	labels := append(slices.Clone(r.labels), string(result))
	counter := r.metrics.requests.WithLabelValues(labels...)
	observer := r.metrics.duration.WithLabelValues(labels...)
	if sc := trace.SpanContextFromContext(r.ctx); sc.IsSampled() {
		exemplar := prometheus.Labels{"traceID": sc.TraceID().String()}
		counter.(prometheus.ExemplarAdder).AddWithExemplar(1, exemplar)
		observer.(prometheus.ExemplarObserver).ObserveWithExemplar(elapsed.Seconds(), exemplar)
		return
	}
	counter.Inc()
	observer.Observe(elapsed.Seconds())
}

// onPanic records a panicking call before propagating the panic.
func (r *callRecorder) onPanic() {
	if p := recover(); p != nil {
		r.finish(ResultServerError)
		panic(p)
	}
}

// ErrorResult classifies the error of a plugin call made with ctx. A nil error
// is ResultOK. A call that outlives its deadline is a timeout, because the
// plugin did not answer in time; one whose caller went away is canceled.
func ErrorResult(ctx context.Context, err error) Result {
	if err == nil {
		return ResultOK
	}
	if ctxErr := ctx.Err(); ctxErr != nil {
		if errors.Is(ctxErr, context.DeadlineExceeded) {
			return ResultTimeout
		}
		return ResultCanceled
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return ResultTimeout
	}
	if errors.Is(err, context.Canceled) {
		return ResultCanceled
	}
	if errors.Is(err, plugins.ErrPluginUnavailable) ||
		errors.Is(err, plugins.ErrPluginNotRegistered) ||
		errors.Is(err, plugins.ErrPluginGrpcConnectionUnavailableBaseFn(ctx)) {
		return ResultUnavailable
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return ResultTimeout
	}
	// Plugin clients report a plugin that isn't running as a Kubernetes status
	// error, such as the lazy client's 503.
	var apiStatus apierrors.APIStatus
	if errors.As(err, &apiStatus) {
		return StatusCodeResult(int(apiStatus.Status().Code), ResultServerError)
	}
	if s, ok := status.FromError(err); ok {
		return grpcCodeResult(s.Code())
	}
	return ResultServerError
}

// StatusCodeResult classifies an HTTP status code from a plugin's response.
// Code 0 means the response carried none, and is classified as unset.
func StatusCodeResult(code int, unset Result) Result {
	switch {
	case code == 0:
		return unset
	case code == http.StatusServiceUnavailable:
		return ResultUnavailable
	case code == http.StatusGatewayTimeout:
		return ResultTimeout
	case code >= 500:
		return ResultServerError
	case code >= 400:
		return ResultClientError
	default:
		return ResultOK
	}
}

func grpcCodeResult(code codes.Code) Result {
	switch code {
	case codes.OK:
		return ResultOK
	case codes.Canceled:
		return ResultCanceled
	case codes.DeadlineExceeded:
		return ResultTimeout
	case codes.Unavailable:
		return ResultUnavailable
	case codes.InvalidArgument, codes.NotFound, codes.AlreadyExists, codes.PermissionDenied,
		codes.Unauthenticated, codes.FailedPrecondition, codes.Aborted, codes.OutOfRange:
		return ResultClientError
	default:
		// Unknown, Internal, Unimplemented, DataLoss and ResourceExhausted.
		return ResultServerError
	}
}

package tracing

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	jaegerpropagator "go.opentelemetry.io/contrib/propagators/jaeger"
	"go.opentelemetry.io/contrib/samplers/jaegerremote"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
	trace "go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc/credentials"

	"github.com/go-kit/log/level"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	envJaegerAgentHost = "JAEGER_AGENT_HOST"
	envJaegerAgentPort = "JAEGER_AGENT_PORT"
)

const (
	jaegerExporter string = "jaeger"
	otlpExporter   string = "otlp"
	noopExporter   string = "noop"

	jaegerPropagator string = "jaeger"
	w3cPropagator    string = "w3c"
)

type TracingService struct {
	cfg *TracingConfig
	log log.Logger

	tracerProvider tracerProvider
	trace.Tracer
}

type tracerProvider interface {
	trace.TracerProvider

	Shutdown(ctx context.Context) error
}

// Tracer defines the service used to create new spans.
type Tracer interface {
	trace.Tracer

	// Inject adds identifying information for the span to the
	// headers defined in [http.Header] map (this mutates http.Header).
	//
	// Implementation quirk: Where OpenTelemetry is used, the [Span] is
	// picked up from [context.Context] and for OpenTracing the
	// information passed as [Span] is preferred.
	// Both the context and span must be derived from the same call to
	// [Tracer.Start].
	Inject(context.Context, http.Header, trace.Span)
}

func ProvideService(tracingCfg *TracingConfig) (*TracingService, error) {
	if tracingCfg == nil {
		return nil, fmt.Errorf("tracingCfg cannot be nil")
	}

	log.RegisterContextualLogProvider(func(ctx context.Context) ([]any, bool) {
		if traceID := TraceIDFromContext(ctx, false); traceID != "" {
			return []any{"traceID", traceID}, true
		}

		return nil, false
	})

	ots := &TracingService{
		cfg: tracingCfg,
		log: log.New("tracing"),
	}

	if err := ots.initOpentelemetryTracer(); err != nil {
		return nil, err
	}
	return ots, nil
}

func NewNoopTracerService() *TracingService {
	tp := &noopTracerProvider{TracerProvider: noop.NewTracerProvider()}
	otel.SetTracerProvider(tp)

	cfg := NewEmptyTracingConfig()
	ots := &TracingService{cfg: cfg, tracerProvider: tp}
	_ = ots.initOpentelemetryTracer()
	return ots
}

func (ots *TracingService) GetTracerProvider() tracerProvider {
	return ots.tracerProvider
}

type noopTracerProvider struct {
	trace.TracerProvider
}

func (noopTracerProvider) Shutdown(ctx context.Context) error {
	return nil
}

func (ots *TracingService) initJaegerTracerProvider() (*tracesdk.TracerProvider, error) {
	var ep jaeger.EndpointOption
	// Create the Jaeger exporter: address can be either agent address (host:port) or collector URL
	if strings.HasPrefix(ots.cfg.Address, "http://") || strings.HasPrefix(ots.cfg.Address, "https://") {
		ots.log.Debug("using jaeger collector", "address", ots.cfg.Address)
		ep = jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(ots.cfg.Address))
	} else if host, port, err := net.SplitHostPort(ots.cfg.Address); err == nil {
		ots.log.Debug("using jaeger agent", "host", host, "port", port)
		ep = jaeger.WithAgentEndpoint(jaeger.WithAgentHost(host), jaeger.WithAgentPort(port), jaeger.WithMaxPacketSize(64000))
	} else {
		return nil, fmt.Errorf("invalid tracer address: %s", ots.cfg.Address)
	}
	exp, err := jaeger.New(ep)
	if err != nil {
		return nil, err
	}

	res, err := resource.New(
		context.Background(),
		resource.WithAttributes(
			// TODO: why are these attributes different from ones added to the
			// OTLP provider?
			semconv.ServiceNameKey.String(ots.cfg.ServiceName),
			attribute.String("environment", "production"),
		),
		resource.WithAttributes(ots.cfg.CustomAttribs...),
	)
	if err != nil {
		return nil, err
	}

	sampler, err := ots.initSampler()
	if err != nil {
		return nil, err
	}

	tp := tracesdk.NewTracerProvider(
		tracesdk.WithBatcher(exp),
		tracesdk.WithResource(res),
		tracesdk.WithSampler(sampler),
	)

	return tp, nil
}

func (ots *TracingService) initOTLPTracerProvider() (*tracesdk.TracerProvider, error) {
	opts := []otlptracegrpc.Option{otlptracegrpc.WithEndpoint(ots.cfg.Address)}
	if ots.cfg.Insecure {
		opts = append(opts, otlptracegrpc.WithInsecure())
	} else {
		opts = append(opts, otlptracegrpc.WithTLSCredentials(credentials.NewTLS(nil)))
	}

	client := otlptracegrpc.NewClient(opts...)
	exp, err := otlptrace.New(context.Background(), client)
	if err != nil {
		return nil, err
	}

	sampler, err := ots.initSampler()
	if err != nil {
		return nil, err
	}

	return initTracerProvider(exp, ots.cfg.ServiceName, ots.cfg.ServiceVersion, sampler, ots.cfg.CustomAttribs...)
}

func (ots *TracingService) initSampler() (tracesdk.Sampler, error) {
	switch ots.cfg.Sampler {
	case "const", "":
		if ots.cfg.SamplerParam >= 1 {
			return tracesdk.AlwaysSample(), nil
		} else if ots.cfg.SamplerParam <= 0 {
			return tracesdk.NeverSample(), nil
		}

		return nil, fmt.Errorf("invalid param for const sampler - must be 0 or 1: %f", ots.cfg.SamplerParam)
	case "probabilistic":
		return tracesdk.TraceIDRatioBased(ots.cfg.SamplerParam), nil
	case "rateLimiting":
		return newRateLimiter(ots.cfg.SamplerParam), nil
	case "remote":
		return jaegerremote.New("grafana",
			jaegerremote.WithSamplingServerURL(ots.cfg.SamplerRemoteURL),
			jaegerremote.WithInitialSampler(tracesdk.TraceIDRatioBased(ots.cfg.SamplerParam)),
		), nil
	default:
		return nil, fmt.Errorf("invalid sampler type: %s", ots.cfg.Sampler)
	}
}

func initTracerProvider(exp tracesdk.SpanExporter, serviceName string, serviceVersion string, sampler tracesdk.Sampler, customAttribs ...attribute.KeyValue) (*tracesdk.TracerProvider, error) {
	res, err := resource.New(
		context.Background(),
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
			semconv.ServiceVersionKey.String(serviceVersion),
		),
		resource.WithAttributes(customAttribs...),
		resource.WithFromEnv(),
		resource.WithProcessRuntimeDescription(),
		resource.WithTelemetrySDK(),
	)
	if err != nil {
		return nil, err
	}

	tp := tracesdk.NewTracerProvider(
		tracesdk.WithBatcher(exp),
		tracesdk.WithSampler(tracesdk.ParentBased(sampler)),
		tracesdk.WithResource(res),
	)
	return tp, nil
}

func (ots *TracingService) initNoopTracerProvider() (tracerProvider, error) {
	return &noopTracerProvider{TracerProvider: noop.NewTracerProvider()}, nil
}

func (ots *TracingService) initOpentelemetryTracer() error {
	var tp tracerProvider
	var err error
	switch ots.cfg.enabled {
	case jaegerExporter:
		tp, err = ots.initJaegerTracerProvider()
		if err != nil {
			return err
		}
	case otlpExporter:
		tp, err = ots.initOTLPTracerProvider()
		if err != nil {
			return err
		}
	default:
		tp, err = ots.initNoopTracerProvider()
		if err != nil {
			return err
		}
	}

	if ots.cfg.ProfilingIntegration {
		tp = NewProfilingTracerProvider(tp)
	}

	// Register our TracerProvider as the global so any imported
	// instrumentation in the future will default to using it
	// only if tracing is enabled
	if ots.cfg.enabled != "" {
		otel.SetTracerProvider(tp)
	}

	propagators := []propagation.TextMapPropagator{}
	for _, p := range strings.Split(ots.cfg.Propagation, ",") {
		switch p {
		case w3cPropagator:
			propagators = append(propagators, propagation.TraceContext{}, propagation.Baggage{})
		case jaegerPropagator:
			propagators = append(propagators, jaegerpropagator.Jaeger{})
		case "":
		default:
			return fmt.Errorf("unsupported OpenTelemetry propagator: %q", p)
		}
	}

	switch len(propagators) {
	case 0:
		otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{}, propagation.Baggage{},
		))
	case 1:
		otel.SetTextMapPropagator(propagators[0])
	default:
		otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagators...))
	}

	if ots.tracerProvider == nil {
		ots.tracerProvider = tp
	}

	ots.Tracer = otel.GetTracerProvider().Tracer("component-main")

	return nil
}

func (ots *TracingService) Run(ctx context.Context) error {
	otel.SetErrorHandler(otel.ErrorHandlerFunc(func(err error) {
		err = level.Error(ots.log).Log("msg", "OpenTelemetry handler returned an error", "err", err)
		if err != nil {
			ots.log.Error("OpenTelemetry log returning error", err)
		}
	}))
	<-ctx.Done()

	ots.log.Info("Closing tracing")
	if ots.tracerProvider == nil {
		return nil
	}
	ctxShutdown, cancel := context.WithTimeout(ctx, time.Second*5)
	defer cancel()

	if err := ots.tracerProvider.Shutdown(ctxShutdown); err != nil {
		return err
	}

	return nil
}

func (ots *TracingService) Inject(ctx context.Context, header http.Header, _ trace.Span) {
	otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(header))
}

func (ots *TracingService) OtelTracer() trace.Tracer {
	return ots
}

type rateLimiter struct {
	sync.Mutex
	description string
	rps         float64
	balance     float64
	maxBalance  float64
	lastTick    time.Time

	now func() time.Time
}

func newRateLimiter(rps float64) *rateLimiter {
	return &rateLimiter{
		rps:         rps,
		description: fmt.Sprintf("RateLimitingSampler{%g}", rps),
		balance:     math.Max(rps, 1),
		maxBalance:  math.Max(rps, 1),
		lastTick:    time.Now(),
		now:         time.Now,
	}
}

func (rl *rateLimiter) ShouldSample(p tracesdk.SamplingParameters) tracesdk.SamplingResult {
	rl.Lock()
	defer rl.Unlock()
	psc := trace.SpanContextFromContext(p.ParentContext)
	if rl.balance >= 1 {
		rl.balance -= 1
		return tracesdk.SamplingResult{Decision: tracesdk.RecordAndSample, Tracestate: psc.TraceState()}
	}
	currentTime := rl.now()
	elapsedTime := currentTime.Sub(rl.lastTick).Seconds()
	rl.lastTick = currentTime
	rl.balance = math.Min(rl.maxBalance, rl.balance+elapsedTime*rl.rps)
	if rl.balance >= 1 {
		rl.balance -= 1
		return tracesdk.SamplingResult{Decision: tracesdk.RecordAndSample, Tracestate: psc.TraceState()}
	}
	return tracesdk.SamplingResult{Decision: tracesdk.Drop, Tracestate: psc.TraceState()}
}

func (rl *rateLimiter) Description() string { return rl.description }

func TraceIDFromContext(ctx context.Context, requireSampled bool) string {
	spanCtx := trace.SpanContextFromContext(ctx)
	if !spanCtx.HasTraceID() || !spanCtx.IsValid() || (requireSampled && !spanCtx.IsSampled()) {
		return ""
	}

	return spanCtx.TraceID().String()
}

func ServerTimingForSpan(span trace.Span) string {
	spanCtx := span.SpanContext()
	if !spanCtx.HasTraceID() || !spanCtx.IsValid() {
		return ""
	}

	return fmt.Sprintf("00-%s-%s-01", spanCtx.TraceID().String(), spanCtx.SpanID().String())
}

// Error sets the status to error and record the error as an exception in the provided span.
func Error(span trace.Span, err error) error {
	attr := []attribute.KeyValue{}
	grafanaErr := errutil.Error{}
	if errors.As(err, &grafanaErr) {
		attr = append(attr, attribute.String("message_id", grafanaErr.MessageID))
	}

	span.SetStatus(codes.Error, err.Error())
	span.RecordError(err, trace.WithAttributes(attr...))
	return err
}

// Errorf wraps fmt.Errorf and also sets the status to error and record the error as an exception in the provided span.
func Errorf(span trace.Span, format string, args ...any) error {
	err := fmt.Errorf(format, args...)
	return Error(span, err)
}

var instrumentationScope = "github.com/grafana/grafana/pkg/infra/tracing"

// Start only creates an OpenTelemetry span if the incoming context already includes a span.
func Start(ctx context.Context, name string, attributes ...attribute.KeyValue) (context.Context, trace.Span) {
	return trace.SpanFromContext(ctx).TracerProvider().Tracer(instrumentationScope).Start(ctx, name, trace.WithAttributes(attributes...))
}

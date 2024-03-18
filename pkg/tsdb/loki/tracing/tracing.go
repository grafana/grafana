package tracing

import (
	"context"
	"fmt"
	"math"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	jaegerpropagator "go.opentelemetry.io/contrib/propagators/jaeger"
	"go.opentelemetry.io/contrib/samplers/jaegerremote"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
	trace "go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/setting"
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
	enabled       string
	Address       string
	Propagation   string
	customAttribs []attribute.KeyValue

	Sampler          string
	SamplerParam     float64
	SamplerRemoteURL string

	log log.Logger

	tracerProvider tracerProvider
	trace.Tracer

	Cfg *setting.Cfg
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

func ProvideService(cfg *setting.Cfg) (*TracingService, error) {
	ots, err := ParseSettings(cfg)
	if err != nil {
		return nil, err
	}

	// The original code in `pkg/infra/tracing/tracing.go` here has code to register a contextual
	// log provider using `RegisterContextualLogProvider` from `pkg/infra/log`. This is not supported
	// by `grafana-plugin-sdk-go/backend/log` and thus has been replaced by `DecorateLogger` in the plugin.

	if err := ots.initOpentelemetryTracer(); err != nil {
		return nil, err
	}
	return ots, nil
}

func ParseSettings(cfg *setting.Cfg) (*TracingService, error) {
	ots := &TracingService{
		Cfg: cfg,
		log: backend.NewLoggerWith("logger", "tracing"),
	}
	err := ots.parseSettings()
	return ots, err
}

func (ots *TracingService) GetTracerProvider() tracerProvider {
	return ots.tracerProvider
}

func TraceIDFromContext(ctx context.Context, requireSampled bool) string {
	spanCtx := trace.SpanContextFromContext(ctx)
	if !spanCtx.HasTraceID() || !spanCtx.IsValid() || (requireSampled && !spanCtx.IsSampled()) {
		return ""
	}

	return spanCtx.TraceID().String()
}

type noopTracerProvider struct {
	trace.TracerProvider
}

func (noopTracerProvider) Shutdown(ctx context.Context) error {
	return nil
}

func (ots *TracingService) parseSettings() error {
	legacyAddress, legacyTags := "", ""
	if section, err := ots.Cfg.Raw.GetSection("tracing.jaeger"); err == nil {
		legacyAddress = section.Key("address").MustString("")
		if legacyAddress == "" {
			host, port := os.Getenv(envJaegerAgentHost), os.Getenv(envJaegerAgentPort)
			if host != "" || port != "" {
				legacyAddress = fmt.Sprintf("%s:%s", host, port)
			}
		}
		legacyTags = section.Key("always_included_tag").MustString("")
		ots.Sampler = section.Key("sampler_type").MustString("")
		ots.SamplerParam = section.Key("sampler_param").MustFloat64(1)
		ots.SamplerRemoteURL = section.Key("sampling_server_url").MustString("")
	}
	section := ots.Cfg.Raw.Section("tracing.opentelemetry")
	var err error
	// we default to legacy tag set (attributes) if the new config format is absent
	ots.customAttribs, err = splitCustomAttribs(section.Key("custom_attributes").MustString(legacyTags))
	if err != nil {
		return err
	}

	// if sampler_type is set in tracing.opentelemetry, we ignore the config in tracing.jaeger
	sampler := section.Key("sampler_type").MustString("")
	if sampler != "" {
		ots.Sampler = sampler
	}

	samplerParam := section.Key("sampler_param").MustFloat64(0)
	if samplerParam != 0 {
		ots.SamplerParam = samplerParam
	}

	samplerRemoteURL := section.Key("sampling_server_url").MustString("")
	if samplerRemoteURL != "" {
		ots.SamplerRemoteURL = samplerRemoteURL
	}

	section = ots.Cfg.Raw.Section("tracing.opentelemetry.jaeger")
	ots.enabled = noopExporter

	// we default to legacy Jaeger agent address if the new config value is empty
	ots.Address = section.Key("address").MustString(legacyAddress)
	ots.Propagation = section.Key("propagation").MustString("")
	if ots.Address != "" {
		ots.enabled = jaegerExporter
		return nil
	}

	section = ots.Cfg.Raw.Section("tracing.opentelemetry.otlp")
	ots.Address = section.Key("address").MustString("")
	if ots.Address != "" {
		ots.enabled = otlpExporter
	}
	ots.Propagation = section.Key("propagation").MustString("")
	return nil
}

func (ots *TracingService) OTelExporterEnabled() bool {
	return ots.enabled == otlpExporter
}

func splitCustomAttribs(s string) ([]attribute.KeyValue, error) {
	res := []attribute.KeyValue{}

	attribs := strings.Split(s, ",")
	for _, v := range attribs {
		parts := strings.SplitN(v, ":", 2)
		if len(parts) > 1 {
			res = append(res, attribute.String(parts[0], parts[1]))
		} else if v != "" {
			return nil, fmt.Errorf("custom attribute malformed - must be in 'key:value' form: %q", v)
		}
	}

	return res, nil
}

func (ots *TracingService) initJaegerTracerProvider() (*tracesdk.TracerProvider, error) {
	var ep jaeger.EndpointOption
	// Create the Jaeger exporter: address can be either agent address (host:port) or collector URL
	if strings.HasPrefix(ots.Address, "http://") || strings.HasPrefix(ots.Address, "https://") {
		ots.log.Debug("using jaeger collector", "address", ots.Address)
		ep = jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(ots.Address))
	} else if host, port, err := net.SplitHostPort(ots.Address); err == nil {
		ots.log.Debug("using jaeger agent", "host", host, "port", port)
		ep = jaeger.WithAgentEndpoint(jaeger.WithAgentHost(host), jaeger.WithAgentPort(port), jaeger.WithMaxPacketSize(64000))
	} else {
		return nil, fmt.Errorf("invalid tracer address: %s", ots.Address)
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
			semconv.ServiceNameKey.String("grafana"),
			attribute.String("environment", "production"),
		),
		resource.WithAttributes(ots.customAttribs...),
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
	client := otlptracegrpc.NewClient(otlptracegrpc.WithEndpoint(ots.Address), otlptracegrpc.WithInsecure())
	exp, err := otlptrace.New(context.Background(), client)
	if err != nil {
		return nil, err
	}

	sampler, err := ots.initSampler()
	if err != nil {
		return nil, err
	}

	return initTracerProvider(exp, ots.Cfg.BuildVersion, sampler, ots.customAttribs...)
}

func (ots *TracingService) initSampler() (tracesdk.Sampler, error) {
	switch ots.Sampler {
	case "const", "":
		if ots.SamplerParam >= 1 {
			return tracesdk.AlwaysSample(), nil
		} else if ots.SamplerParam <= 0 {
			return tracesdk.NeverSample(), nil
		}

		return nil, fmt.Errorf("invalid param for const sampler - must be 0 or 1: %f", ots.SamplerParam)
	case "probabilistic":
		return tracesdk.TraceIDRatioBased(ots.SamplerParam), nil
	case "rateLimiting":
		return newRateLimiter(ots.SamplerParam), nil
	case "remote":
		return jaegerremote.New("grafana",
			jaegerremote.WithSamplingServerURL(ots.SamplerRemoteURL),
			jaegerremote.WithInitialSampler(tracesdk.TraceIDRatioBased(ots.SamplerParam)),
		), nil
	default:
		return nil, fmt.Errorf("invalid sampler type: %s", ots.Sampler)
	}
}

func initTracerProvider(exp tracesdk.SpanExporter, version string, sampler tracesdk.Sampler, customAttribs ...attribute.KeyValue) (*tracesdk.TracerProvider, error) {
	res, err := resource.New(
		context.Background(),
		resource.WithAttributes(
			semconv.ServiceNameKey.String("grafana"),
			semconv.ServiceVersionKey.String(version),
		),
		resource.WithAttributes(customAttribs...),
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
	switch ots.enabled {
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

	// Register our TracerProvider as the global so any imported
	// instrumentation in the future will default to using it
	// only if tracing is enabled
	if ots.enabled != "" {
		otel.SetTracerProvider(tp)
	}

	propagators := []propagation.TextMapPropagator{}
	for _, p := range strings.Split(ots.Propagation, ",") {
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
		ots.log.Error("OpenTelemetry handler returned an error", "msg", err)
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

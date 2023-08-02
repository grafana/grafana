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
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	trace "go.opentelemetry.io/otel/trace"

	"github.com/go-kit/log/level"
	"github.com/grafana/grafana/pkg/infra/log"
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

type Opentelemetry struct {
	enabled       string
	Address       string
	Propagation   string
	customAttribs []attribute.KeyValue

	sampler          string
	samplerParam     float64
	samplerRemoteURL string

	log log.Logger

	tracerProvider tracerProvider
	tracer         trace.Tracer

	Cfg *setting.Cfg
}

type tracerProvider interface {
	trace.TracerProvider

	Shutdown(ctx context.Context) error
}

type OpentelemetrySpan struct {
	span trace.Span
}

type EventValue struct {
	Str string
	Num int64
}

// Tracer defines the service used to create new spans.
type Tracer interface {
	// Run implements registry.BackgroundService.
	Run(context.Context) error
	// Start creates a new [Span] and places trace metadata on the
	// [context.Context] passed to the method.
	// Chose a low cardinality spanName and use [Span.SetAttributes]
	// or [Span.AddEvents] for high cardinality data.
	Start(ctx context.Context, spanName string, opts ...trace.SpanStartOption) (context.Context, Span)
	// Inject adds identifying information for the span to the
	// headers defined in [http.Header] map (this mutates http.Header).
	//
	// Implementation quirk: Where OpenTelemetry is used, the [Span] is
	// picked up from [context.Context] and for OpenTracing the
	// information passed as [Span] is preferred.
	// Both the context and span must be derived from the same call to
	// [Tracer.Start].
	Inject(context.Context, http.Header, Span)
}

// Span defines a time range for an operation. This is equivalent to a
// single line in a flame graph.
type Span interface {
	// End finalizes the Span and adds its end timestamp.
	// Any further operations on the Span are not permitted after
	// End has been called.
	End()
	// SetAttributes adds additional data to a span.
	// SetAttributes repeats the key value pair with [string] and [any]
	// used for OpenTracing and [attribute.KeyValue] used for
	// OpenTelemetry.
	SetAttributes(key string, value interface{}, kv attribute.KeyValue)
	// SetName renames the span.
	SetName(name string)
	// SetStatus can be used to indicate whether the span was
	// successfully or unsuccessfully executed.
	//
	// Only useful for OpenTelemetry.
	SetStatus(code codes.Code, description string)
	// RecordError adds an error to the span.
	//
	// Only useful for OpenTelemetry.
	RecordError(err error, options ...trace.EventOption)
	// AddEvents adds additional data with a temporal dimension to the
	// span.
	//
	// Panics if the length of keys is shorter than the length of values.
	AddEvents(keys []string, values []EventValue)

	// contextWithSpan returns a context.Context that holds the parent
	// context plus a reference to this span.
	contextWithSpan(ctx context.Context) context.Context
}

func ProvideService(cfg *setting.Cfg) (Tracer, error) {
	ots, err := ParseSettings(cfg)
	if err != nil {
		return nil, err
	}

	log.RegisterContextualLogProvider(func(ctx context.Context) ([]interface{}, bool) {
		if traceID := TraceIDFromContext(ctx, false); traceID != "" {
			return []interface{}{"traceID", traceID}, true
		}

		return nil, false
	})
	if err := ots.initOpentelemetryTracer(); err != nil {
		return nil, err
	}
	return ots, nil
}

func ParseSettings(cfg *setting.Cfg) (*Opentelemetry, error) {
	ots := &Opentelemetry{
		Cfg: cfg,
		log: log.New("tracing"),
	}
	err := ots.parseSettings()
	return ots, err
}

type traceKey struct{}
type traceValue struct {
	ID        string
	IsSampled bool
}

func TraceIDFromContext(c context.Context, requireSampled bool) string {
	v := c.Value(traceKey{})
	// Return traceID if a) it is present and b) it is sampled when requireSampled param is true
	if trace, ok := v.(traceValue); ok && (!requireSampled || trace.IsSampled) {
		return trace.ID
	}
	return ""
}

// SpanFromContext returns the Span previously associated with ctx, or nil, if no such span could be found.
// It is the equivalent of opentracing.SpanFromContext and trace.SpanFromContext.
func SpanFromContext(ctx context.Context) Span {
	if span := trace.SpanFromContext(ctx); span != nil {
		return OpentelemetrySpan{span: span}
	}
	return nil
}

// ContextWithSpan returns a new context.Context that holds a reference to the given span.
// If span is nil, a new context without an active span is returned.
// It is the equivalent of opentracing.ContextWithSpan and trace.ContextWithSpan.
func ContextWithSpan(ctx context.Context, span Span) context.Context {
	if span != nil {
		return span.contextWithSpan(ctx)
	}
	return ctx
}

type noopTracerProvider struct {
	trace.TracerProvider
}

func (noopTracerProvider) Shutdown(ctx context.Context) error {
	return nil
}

func (ots *Opentelemetry) parseSettings() error {
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
		ots.sampler = section.Key("sampler_type").MustString("")
		ots.samplerParam = section.Key("sampler_param").MustFloat64(1)
		ots.samplerRemoteURL = section.Key("sampling_server_url").MustString("")
	}
	section := ots.Cfg.Raw.Section("tracing.opentelemetry")
	var err error
	// we default to legacy tag set (attributes) if the new config format is absent
	ots.customAttribs, err = splitCustomAttribs(section.Key("custom_attributes").MustString(legacyTags))
	if err != nil {
		return err
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

func (ots *Opentelemetry) OTelExporterEnabled() bool {
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

func (ots *Opentelemetry) initJaegerTracerProvider() (*tracesdk.TracerProvider, error) {
	var ep jaeger.EndpointOption
	// Create the Jaeger exporter: address can be either agent address (host:port) or collector URL
	if host, port, err := net.SplitHostPort(ots.Address); err == nil {
		ep = jaeger.WithAgentEndpoint(jaeger.WithAgentHost(host), jaeger.WithAgentPort(port))
	} else {
		ep = jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(ots.Address))
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

	sampler := tracesdk.AlwaysSample()
	if ots.sampler == "const" || ots.sampler == "probabilistic" {
		sampler = tracesdk.TraceIDRatioBased(ots.samplerParam)
	} else if ots.sampler == "rateLimiting" {
		sampler = newRateLimiter(ots.samplerParam)
	} else if ots.sampler == "remote" {
		sampler = jaegerremote.New("grafana", jaegerremote.WithSamplingServerURL(ots.samplerRemoteURL),
			jaegerremote.WithInitialSampler(tracesdk.TraceIDRatioBased(ots.samplerParam)))
	} else if ots.sampler != "" {
		return nil, fmt.Errorf("invalid sampler type: %s", ots.sampler)
	}

	tp := tracesdk.NewTracerProvider(
		tracesdk.WithBatcher(exp),
		tracesdk.WithResource(res),
		tracesdk.WithSampler(sampler),
	)

	return tp, nil
}

func (ots *Opentelemetry) initOTLPTracerProvider() (*tracesdk.TracerProvider, error) {
	client := otlptracegrpc.NewClient(otlptracegrpc.WithEndpoint(ots.Address), otlptracegrpc.WithInsecure())
	exp, err := otlptrace.New(context.Background(), client)
	if err != nil {
		return nil, err
	}

	return initTracerProvider(exp, ots.Cfg.BuildVersion, ots.customAttribs...)
}

func initTracerProvider(exp tracesdk.SpanExporter, version string, customAttribs ...attribute.KeyValue) (*tracesdk.TracerProvider, error) {
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
		tracesdk.WithSampler(tracesdk.ParentBased(
			tracesdk.AlwaysSample(),
		)),
		tracesdk.WithResource(res),
	)
	return tp, nil
}

func (ots *Opentelemetry) initNoopTracerProvider() (tracerProvider, error) {
	return &noopTracerProvider{TracerProvider: trace.NewNoopTracerProvider()}, nil
}

func (ots *Opentelemetry) initOpentelemetryTracer() error {
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

	ots.tracer = otel.GetTracerProvider().Tracer("component-main")

	return nil
}

func (ots *Opentelemetry) Run(ctx context.Context) error {
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

func (ots *Opentelemetry) Start(ctx context.Context, spanName string, opts ...trace.SpanStartOption) (context.Context, Span) {
	ctx, span := ots.tracer.Start(ctx, spanName, opts...)
	opentelemetrySpan := OpentelemetrySpan{
		span: span,
	}

	if traceID := span.SpanContext().TraceID(); traceID.IsValid() {
		ctx = context.WithValue(ctx, traceKey{}, traceValue{traceID.String(), span.SpanContext().IsSampled()})
	}

	return ctx, opentelemetrySpan
}

func (ots *Opentelemetry) Inject(ctx context.Context, header http.Header, _ Span) {
	otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(header))
}

func (s OpentelemetrySpan) End() {
	s.span.End()
}

func (s OpentelemetrySpan) SetAttributes(key string, value interface{}, kv attribute.KeyValue) {
	s.span.SetAttributes(kv)
}

func (s OpentelemetrySpan) SetName(name string) {
	s.span.SetName(name)
}

func (s OpentelemetrySpan) SetStatus(code codes.Code, description string) {
	s.span.SetStatus(code, description)
}

func (s OpentelemetrySpan) RecordError(err error, options ...trace.EventOption) {
	s.span.RecordError(err, options...)
}

func (s OpentelemetrySpan) AddEvents(keys []string, values []EventValue) {
	for i, v := range values {
		if v.Str != "" {
			s.span.AddEvent(keys[i], trace.WithAttributes(attribute.Key(keys[i]).String(v.Str)))
		}
		if v.Num != 0 {
			s.span.AddEvent(keys[i], trace.WithAttributes(attribute.Key(keys[i]).Int64(v.Num)))
		}
	}
}

func (s OpentelemetrySpan) contextWithSpan(ctx context.Context) context.Context {
	if s.span != nil {
		ctx = trace.ContextWithSpan(ctx, s.span)
		// Grafana also manages its own separate traceID in the context in addition to what opentracing handles.
		// It's derived from the span. Ensure that we propagate this too.
		if traceID := s.span.SpanContext().TraceID(); traceID.IsValid() {
			ctx = context.WithValue(ctx, traceKey{}, traceValue{traceID.String(), s.span.SpanContext().IsSampled()})
		}
	}
	return ctx
}

type rateLimiter struct {
	sync.Mutex
	rps        float64
	balance    float64
	maxBalance float64
	lastTick   time.Time

	now func() time.Time
}

func newRateLimiter(rps float64) *rateLimiter {
	return &rateLimiter{
		rps:        rps,
		balance:    math.Max(rps, 1),
		maxBalance: math.Max(rps, 1),
		lastTick:   time.Now(),
		now:        time.Now,
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

func (rl *rateLimiter) Description() string { return "RateLimitingSampler" }

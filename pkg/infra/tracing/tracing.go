package tracing

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	opentracing "github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	ol "github.com/opentracing/opentracing-go/log"
	"github.com/uber/jaeger-client-go"
	jaegercfg "github.com/uber/jaeger-client-go/config"
	"github.com/uber/jaeger-client-go/zipkin"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	trace "go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	envJaegerAgentHost = "JAEGER_AGENT_HOST"
	envJaegerAgentPort = "JAEGER_AGENT_PORT"
)

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
	ts, ots, err := parseSettings(cfg)
	if err != nil {
		return nil, err
	}

	log.RegisterContextualLogProvider(func(ctx context.Context) ([]interface{}, bool) {
		if traceID := TraceIDFromContext(ctx, false); traceID != "" {
			return []interface{}{"traceID", traceID}, true
		}

		return nil, false
	})

	if ts.enabled {
		return ts, ts.initJaegerGlobalTracer()
	}

	return ots, ots.initOpentelemetryTracer()
}

func parseSettings(cfg *setting.Cfg) (*Opentracing, *Opentelemetry, error) {
	ts, err := parseSettingsOpentracing(cfg)
	if err != nil {
		return ts, nil, err
	}
	ots, err := ParseSettingsOpentelemetry(cfg)
	return ts, ots, err
}

func parseSettingsOpentracing(cfg *setting.Cfg) (*Opentracing, error) {
	ts := &Opentracing{
		Cfg: cfg,
		log: log.New("tracing"),
	}
	if err := ts.parseSettings(); err != nil {
		return ts, err
	}
	if ts.enabled {
		cfg.Logger.Warn("[Deprecated] the configuration setting 'tracing.jaeger' is deprecated, please use 'tracing.opentelemetry.jaeger' instead")
	}
	return ts, nil
}

func ParseSettingsOpentelemetry(cfg *setting.Cfg) (*Opentelemetry, error) {
	ots := &Opentelemetry{
		Cfg: cfg,
		log: log.New("tracing"),
	}
	err := ots.parseSettingsOpentelemetry()
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
	// Look for both opentracing and opentelemetry spans.
	if span := opentracing.SpanFromContext(ctx); span != nil {
		return OpentracingSpan{span: span}
	}
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

type Opentracing struct {
	enabled                  bool
	address                  string
	customTags               map[string]string
	samplerType              string
	samplerParam             float64
	samplingServerURL        string
	log                      log.Logger
	closer                   io.Closer
	zipkinPropagation        bool
	disableSharedZipkinSpans bool

	Cfg *setting.Cfg
}

type OpentracingSpan struct {
	span opentracing.Span
}

func (ts *Opentracing) parseSettings() error {
	var section, err = ts.Cfg.Raw.GetSection("tracing.jaeger")
	if err != nil {
		return err
	}

	ts.address = section.Key("address").MustString("")
	if ts.address == "" {
		host := os.Getenv(envJaegerAgentHost)
		port := os.Getenv(envJaegerAgentPort)
		if host != "" || port != "" {
			ts.address = fmt.Sprintf("%s:%s", host, port)
		}
	}
	if ts.address != "" {
		ts.enabled = true
	}

	ts.customTags = splitTagSettings(section.Key("always_included_tag").MustString(""))
	ts.samplerType = section.Key("sampler_type").MustString("")
	ts.samplerParam = section.Key("sampler_param").MustFloat64(1)
	ts.zipkinPropagation = section.Key("zipkin_propagation").MustBool(false)
	ts.disableSharedZipkinSpans = section.Key("disable_shared_zipkin_spans").MustBool(false)
	ts.samplingServerURL = section.Key("sampling_server_url").MustString("")
	return nil
}

func (ts *Opentracing) initJaegerCfg() (jaegercfg.Configuration, error) {
	cfg := jaegercfg.Configuration{
		ServiceName: "grafana",
		Disabled:    !ts.enabled,
		Sampler: &jaegercfg.SamplerConfig{
			Type:              ts.samplerType,
			Param:             ts.samplerParam,
			SamplingServerURL: ts.samplingServerURL,
		},
		Reporter: &jaegercfg.ReporterConfig{
			LogSpans:           false,
			LocalAgentHostPort: ts.address,
		},
	}

	_, err := cfg.FromEnv()
	if err != nil {
		return cfg, err
	}
	return cfg, nil
}

func (ts *Opentracing) initJaegerGlobalTracer() error {
	cfg, err := ts.initJaegerCfg()
	if err != nil {
		return err
	}

	jLogger := &jaegerLogWrapper{logger: log.New("jaeger")}

	options := []jaegercfg.Option{}
	options = append(options, jaegercfg.Logger(jLogger))

	for tag, value := range ts.customTags {
		options = append(options, jaegercfg.Tag(tag, value))
	}

	if ts.zipkinPropagation {
		zipkinPropagator := zipkin.NewZipkinB3HTTPHeaderPropagator()
		options = append(options,
			jaegercfg.Injector(opentracing.HTTPHeaders, zipkinPropagator),
			jaegercfg.Extractor(opentracing.HTTPHeaders, zipkinPropagator),
		)

		if !ts.disableSharedZipkinSpans {
			options = append(options, jaegercfg.ZipkinSharedRPCSpan(true))
		}
	}

	tracer, closer, err := cfg.NewTracer(options...)
	if err != nil {
		return err
	}

	opentracing.SetGlobalTracer(tracer)

	ts.closer = closer
	return nil
}

func (ts *Opentracing) Run(ctx context.Context) error {
	<-ctx.Done()

	if ts.closer != nil {
		ts.log.Info("Closing tracing")
		return ts.closer.Close()
	}

	return nil
}

func (ts *Opentracing) Start(ctx context.Context, spanName string, opts ...trace.SpanStartOption) (context.Context, Span) {
	span, ctx := opentracing.StartSpanFromContext(ctx, spanName)
	opentracingSpan := OpentracingSpan{span: span}
	if sctx, ok := span.Context().(jaeger.SpanContext); ok {
		ctx = context.WithValue(ctx, traceKey{}, traceValue{sctx.TraceID().String(), sctx.IsSampled()})
	}
	return ctx, opentracingSpan
}

func (ts *Opentracing) Inject(ctx context.Context, header http.Header, span Span) {
	opentracingSpan, ok := span.(OpentracingSpan)
	if !ok {
		logger.Error("Failed to cast opentracing span")
	}
	err := opentracing.GlobalTracer().Inject(
		opentracingSpan.span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(header))

	if err != nil {
		logger.Error("Failed to inject span context instance", "err", err)
	}
}

func (s OpentracingSpan) End() {
	s.span.Finish()
}

func (s OpentracingSpan) SetAttributes(key string, value interface{}, kv attribute.KeyValue) {
	s.span.SetTag(key, value)
}

func (s OpentracingSpan) SetName(name string) {
	s.span.SetOperationName(name)
}

func (s OpentracingSpan) SetStatus(code codes.Code, description string) {
	if code == codes.Error {
		ext.Error.Set(s.span, true)
	}
}

func (s OpentracingSpan) RecordError(err error, options ...trace.EventOption) {
	ext.Error.Set(s.span, true)
}

func (s OpentracingSpan) AddEvents(keys []string, values []EventValue) {
	fields := []ol.Field{}
	for i, v := range values {
		if v.Str != "" {
			field := ol.String(keys[i], v.Str)
			fields = append(fields, field)
		}
		if v.Num != 0 {
			field := ol.Int64(keys[i], v.Num)
			fields = append(fields, field)
		}
	}
	s.span.LogFields(fields...)
}

func (s OpentracingSpan) contextWithSpan(ctx context.Context) context.Context {
	if s.span != nil {
		ctx = opentracing.ContextWithSpan(ctx, s.span)
		// Grafana also manages its own separate traceID in the context in addition to what opentracing handles.
		// It's derived from the span. Ensure that we propagate this too.
		if sctx, ok := s.span.Context().(jaeger.SpanContext); ok {
			ctx = context.WithValue(ctx, traceKey{}, traceValue{sctx.TraceID().String(), sctx.IsSampled()})
		}
	}
	return ctx
}

func splitTagSettings(input string) map[string]string {
	res := map[string]string{}

	tags := strings.Split(input, ",")
	for _, v := range tags {
		kv := strings.Split(v, ":")
		if len(kv) > 1 {
			res[kv[0]] = kv[1]
		}
	}

	return res
}

type jaegerLogWrapper struct {
	logger log.Logger
}

func (jlw *jaegerLogWrapper) Error(msg string) {
	jlw.logger.Error(msg)
}

func (jlw *jaegerLogWrapper) Infof(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	jlw.logger.Info(msg)
}

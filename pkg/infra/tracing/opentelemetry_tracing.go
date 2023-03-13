package tracing

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-kit/log/level"
	"go.etcd.io/etcd/api/v3/version"
	"go.opentelemetry.io/contrib/propagators/autoprop"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.18.0"
	trace "go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	jaegerExporter   string = "jaeger"
	otlpExporter     string = "otlp"
	otlpHttpExporter string = "otlphttp"
	noopExporter     string = "noop"

	jaegerPropagator string = "jaeger"
	w3cPropagator    string = "w3c"
)

type OpenTelemetry struct {
	enabled       string
	address       string
	propagation   string
	customAttribs []attribute.KeyValue
	log           log.Logger

	tracerProvider tracerProvider
	tracer         trace.Tracer

	Cfg *setting.Cfg

	exporters map[string]ExporterConfig
}

func NewOpenTelemetry(cfg *setting.Cfg, logger log.Logger) *OpenTelemetry {

	return &OpenTelemetry{
		log:       logger.New("tracing.opentelemetry"),
		exporters: make(map[string]ExporterConfig),
		Cfg:       cfg,
	}
}

type ExporterConfig interface {
	ToExporter() (tracesdk.SpanExporter, error)
}

type OTLPExporterConfig struct {
	ExporterConfig
	Insecure       bool     `ini:"insecure"`
	LegacyEndpoint string   `ini:"address"`
	Endpoint       string   `ini:"endpoint"`
	Propagation    []string `ini:"propagation"`
}

func (e OTLPExporterConfig) ToExporter() (tracesdk.SpanExporter, error) {
	// silently fallback to legacy endpoint
	endpoint := e.LegacyEndpoint
	if endpoint == "" {
		endpoint = e.Endpoint
	}

	options := make([]otlptracegrpc.Option, 0)
	options = append(options, otlptracegrpc.WithEndpoint(endpoint))

	if e.Insecure {
		options = append(options, otlptracegrpc.WithInsecure())
	}

	client := otlptracegrpc.NewClient(options...)
	return otlptrace.New(context.Background(), client)
}

type OTLPHTTPExporterConfig struct {
	ExporterConfig
	Endpoint    string   `ini:"endpoint"`
	Headers     []string `ini:"headers"`
	Insecure    bool     `ini:"insecure"`
	Propagation []string `ini:"propagation"`
}

func (e OTLPHTTPExporterConfig) ToExporter() (tracesdk.SpanExporter, error) {
	headers := make(map[string]string)
	for _, header := range e.Headers {
		pair := strings.Split(header, ":")
		headers[strings.Trim(pair[0], " ")] = strings.Trim(pair[1], " ")
	}

	path := ""
	endpoint := e.Endpoint

	// edge-case: if the endpoint contains a path, we need to split it out to accomodate the special
	// needs of the go OTLP/HTTP exporter
	if strings.Contains(e.Endpoint, "/") {
		parts := strings.SplitN(e.Endpoint, "/", 2)
		endpoint = parts[0]
		path = fmt.Sprintf("/%s", parts[1])
	}

	options := make([]otlptracehttp.Option, 0)
	options = append(options, otlptracehttp.WithEndpoint(endpoint))
	options = append(options, otlptracehttp.WithHeaders(headers))

	if path != "" && path != "/" {
		path = fmt.Sprintf("%s/v1/traces", strings.TrimRight(path, "/"))
		options = append(options, otlptracehttp.WithURLPath(path))
	}

	if e.Insecure {
		options = append(options, otlptracehttp.WithInsecure())
	}

	client := otlptracehttp.NewClient(options...)

	return otlptrace.New(context.Background(), client)
}

type JaegerExporterConfig struct {
	ExporterConfig
	Address     string   `ini:"address"`
	Propagation []string `ini:"propagation"`
}

func (e JaegerExporterConfig) ToExporter() (tracesdk.SpanExporter, error) {
	return jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(e.Address)))
}

type tracerProvider interface {
	trace.TracerProvider

	Shutdown(ctx context.Context) error
}

type OpenTelemetrySpan struct {
	span trace.Span
}

type EventValue struct {
	Str string
	Num int64
}

type otelErrHandler func(err error)

func (o otelErrHandler) Handle(err error) {
	o(err)
}

type noopTracerProvider struct {
	trace.TracerProvider
}

func (noopTracerProvider) Shutdown(ctx context.Context) error {
	return nil
}

func (ots *OpenTelemetry) parseSettingsOpentelemetry() error {
	section, err := ots.Cfg.Raw.GetSection("tracing.opentelemetry")
	if err != nil {
		return err
	}

	ots.customAttribs, err = splitCustomAttribs(section.Key("custom_attributes").MustString(""))
	if err != nil {
		return err
	}

	section, err = ots.Cfg.Raw.GetSection("tracing.opentelemetry.jaeger")
	if err != nil {
		return err
	}
	ots.enabled = noopExporter

	jaegerExporterConfig := JaegerExporterConfig{}
	err = section.MapTo(&jaegerExporterConfig)
	if err != nil {
		return err
	}

	if jaegerExporterConfig.Address != "" {
		ots.enabled = otlpExporter
		ots.exporters[jaegerExporter] = jaegerExporterConfig
		return nil
	}

	ots.address = section.Key("address").MustString("")
	ots.propagation = section.Key("propagation").MustString("")
	if ots.address != "" {
		ots.enabled = jaegerExporter
		return nil
	}

	section, err = ots.Cfg.Raw.GetSection("tracing.opentelemetry.otlp")
	if err != nil {
		return err
	}

	otlpExporterConfig := OTLPExporterConfig{}
	err = section.MapTo(&otlpExporterConfig)
	if err != nil {
		return err
	}

	if otlpExporterConfig.Endpoint != "" {
		ots.enabled = otlpExporter
		ots.exporters[otlpExporter] = otlpExporterConfig
		return nil
	}

	section, err = ots.Cfg.Raw.GetSection("tracing.opentelemetry.otlphttp")
	if err != nil {
		return err
	}

	otlpHttpExporterConfig := OTLPHTTPExporterConfig{}
	err = section.MapTo(&otlpHttpExporterConfig)
	if err != nil {
		return err
	}

	if otlpHttpExporterConfig.Endpoint != "" {
		ots.enabled = otlpHttpExporter
		ots.exporters[otlpHttpExporter] = otlpHttpExporterConfig
	}

	return nil
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

// createResource creates a resource with the service name and version
// the resource is uniform across all exporters
func (ots *OpenTelemetry) createResource() (*resource.Resource, error) {

	return resource.New(
		context.Background(),
		// detect additional resource attributes from OTEL_RESOURCE_ATTRIBUTES
		resource.WithFromEnv(),
		resource.WithAttributes(
			semconv.ServiceNameKey.String("grafana"),
			semconv.ServiceVersionKey.String(version.Version),
		),
		resource.WithAttributes(ots.customAttribs...),
		resource.WithProcessRuntimeDescription(),
		resource.WithTelemetrySDK(),
	)
}

func (ots *OpenTelemetry) createPropagatorMap(propagators []string) propagation.TextMapPropagator {
	// register fallback for known value of "w3c"
	autoprop.RegisterTextMapPropagator("w3c", propagation.TraceContext{})

	return autoprop.NewTextMapPropagator()
}

func (ots *OpenTelemetry) initJaegerTracerProvider() (*tracesdk.TracerProvider, error) {
	// Create the Jaeger exporter

	exp, err := ots.exporters[jaegerExporter].ToExporter()
	if err != nil {
		return nil, err
	}

	res, err := ots.createResource()
	if err != nil {
		return nil, err
	}

	tp := tracesdk.NewTracerProvider(
		tracesdk.WithBatcher(exp),
		tracesdk.WithResource(res),
	)

	return tp, nil
}

func (ots *OpenTelemetry) initOTLPTracerProvider() (*tracesdk.TracerProvider, error) {
	exp, err := ots.exporters[otlpExporter].ToExporter()
	if err != nil {
		return nil, err
	}

	res, err := ots.createResource()
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

func (ots *OpenTelemetry) initOTLPHTTPTracerProvider() (*tracesdk.TracerProvider, error) {
	exp, err := ots.exporters[otlpHttpExporter].ToExporter()
	if err != nil {
		return nil, err
	}

	res, err := ots.createResource()
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

func (ots *OpenTelemetry) initNoopTracerProvider() (tracerProvider, error) {
	return &noopTracerProvider{TracerProvider: trace.NewNoopTracerProvider()}, nil
}

func (ots *OpenTelemetry) initOpenTelemetryTracer() error {
	var tp tracerProvider
	var err error

	propagation := ots.createPropagatorMap(strings.Split("none", ""))

	switch ots.enabled {
	case jaegerExporter:
		tp, err = ots.initJaegerTracerProvider()
		if err != nil {
			return err
		}
		propagation = ots.createPropagatorMap(ots.exporters[jaegerExporter].(JaegerExporterConfig).Propagation)
	case otlpExporter:
		tp, err = ots.initOTLPTracerProvider()
		if err != nil {
			return err
		}
		propagation = ots.createPropagatorMap(ots.exporters[otlpExporter].(OTLPExporterConfig).Propagation)
	case otlpHttpExporter:
		tp, err = ots.initOTLPHTTPTracerProvider()
		if err != nil {
			return err
		}
		propagation = ots.createPropagatorMap(ots.exporters[otlpHttpExporter].(OTLPHTTPExporterConfig).Propagation)
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

	otel.SetTextMapPropagator(propagation)

	ots.tracerProvider = tp
	ots.tracer = otel.GetTracerProvider().Tracer("component-main")

	return nil
}

func (ots *OpenTelemetry) Run(ctx context.Context) error {
	otel.SetErrorHandler(otelErrHandler(func(err error) {
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

func (ots *OpenTelemetry) Start(ctx context.Context, spanName string, opts ...trace.SpanStartOption) (context.Context, Span) {
	ctx, span := ots.tracer.Start(ctx, spanName, opts...)
	opentelemetrySpan := OpenTelemetrySpan{
		span: span,
	}

	if traceID := span.SpanContext().TraceID(); traceID.IsValid() {
		ctx = context.WithValue(ctx, traceKey{}, traceValue{traceID.String(), span.SpanContext().IsSampled()})
	}

	return ctx, opentelemetrySpan
}

func (ots *OpenTelemetry) Inject(ctx context.Context, header http.Header, _ Span) {
	otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(header))
}

func (s OpenTelemetrySpan) End() {
	s.span.End()
}

func (s OpenTelemetrySpan) SetAttributes(key string, value interface{}, kv attribute.KeyValue) {
	s.span.SetAttributes(kv)
}

func (s OpenTelemetrySpan) SetName(name string) {
	s.span.SetName(name)
}

func (s OpenTelemetrySpan) SetStatus(code codes.Code, description string) {
	s.span.SetStatus(code, description)
}

func (s OpenTelemetrySpan) RecordError(err error, options ...trace.EventOption) {
	s.span.RecordError(err, options...)
}

func (s OpenTelemetrySpan) AddEvents(keys []string, values []EventValue) {
	for i, v := range values {
		if v.Str != "" {
			s.span.AddEvent(keys[i], trace.WithAttributes(attribute.Key(keys[i]).String(v.Str)))
		}
		if v.Num != 0 {
			s.span.AddEvent(keys[i], trace.WithAttributes(attribute.Key(keys[i]).Int64(v.Num)))
		}
	}
}

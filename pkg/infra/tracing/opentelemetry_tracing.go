package tracing

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-kit/log/level"
	"go.etcd.io/etcd/api/v3/version"
	"go.opentelemetry.io/contrib/propagators/autoprop"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
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
)

var registerPropagatorsOnce sync.Once

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

func (ots OpenTelemetry) Unwrap() interface{} {
	return ots.tracer
}

func (ots OpenTelemetry) UnwrapExporter() (tracesdk.SpanExporter, error) {
	return ots.exporters[ots.enabled].ToExporter()
}

func NewOpenTelemetry(cfg *setting.Cfg, logger log.Logger) *OpenTelemetry {

	return &OpenTelemetry{
		log:       logger.New("tracing.opentelemetry"),
		exporters: make(map[string]ExporterConfig),
		Cfg:       cfg,
	}
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

func (ots *OpenTelemetry) createPropagatorMap(propagators []string) (propagation.TextMapPropagator, error) {
	// register fallback for known value of "w3c"; this is static and duplicates will panic - let's do it once
	registerPropagatorsOnce.Do(func() {
		autoprop.RegisterTextMapPropagator("w3c", propagation.TraceContext{})
	})

	return autoprop.TextMapPropagator(propagators...)
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

	var propagation propagation.TextMapPropagator

	switch ots.enabled {
	case jaegerExporter:
		tp, err = ots.initJaegerTracerProvider()
		if err != nil {
			return err
		}
		propagation, err = ots.createPropagatorMap(ots.exporters[jaegerExporter].(JaegerExporterConfig).Propagation)
		if err != nil {
			return err
		}
	case otlpExporter:
		tp, err = ots.initOTLPTracerProvider()
		if err != nil {
			return err
		}
		propagation, err = ots.createPropagatorMap(ots.exporters[otlpExporter].(OTLPExporterConfig).Propagation)
		if err != nil {
			return err
		}
	case otlpHttpExporter:
		tp, err = ots.initOTLPHTTPTracerProvider()
		if err != nil {
			return err
		}
		propagation, err = ots.createPropagatorMap(ots.exporters[otlpHttpExporter].(OTLPHTTPExporterConfig).Propagation)
		if err != nil {
			return err
		}
	default:
		tp, err = ots.initNoopTracerProvider()
		if err != nil {
			return err
		}
		propagation, err = ots.createPropagatorMap(strings.Split("none", " "))
		if err != nil {
			return err
		}
	}

	otel.SetTracerProvider(tp)

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

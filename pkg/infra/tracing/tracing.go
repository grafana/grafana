package tracing

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"

	"go.opentelemetry.io/contrib/propagators/b3"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/sdk/resource"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	trace "go.opentelemetry.io/otel/trace"
)

const (
	envJaegerAgentHost = "JAEGER_AGENT_HOST"
	envJaegerAgentPort = "JAEGER_AGENT_PORT"
)

var Tracer trace.Tracer

func ProvideService(cfg *setting.Cfg) (*TracingService, error) {
	ts := &TracingService{
		Cfg: cfg,
		log: log.New("tracing"),
	}
	if err := ts.parseSettings(); err != nil {
		return nil, err
	}

	return ts, ts.initGlobalTracer()
}

type TracingService struct {
	enabled                  bool
	address                  string
	customTags               map[string]string
	samplerType              string
	samplerParam             float64
	samplingServerURL        string
	log                      log.Logger
	zipkinPropagation        bool
	disableSharedZipkinSpans bool
	tracerProvider           *tracesdk.TracerProvider

	Cfg *setting.Cfg
}

func (ts *TracingService) parseSettings() error {
	// TODO to add other distributed tracing systems
	return ts.parseJaegerSettings()
}

func (ts *TracingService) parseJaegerSettings() error {
	section, err := ts.Cfg.Raw.GetSection("tracing.jaeger")
	if err != nil {
		return err
	}
	ts.address = section.Key("address").MustString("")

	host := os.Getenv(envJaegerAgentHost)
	port := os.Getenv(envJaegerAgentPort)
	if host != "" || port != "" {
		ts.address = fmt.Sprintf("%s:%s", host, port)
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

func (ts *TracingService) initJaegerCfg() (*tracesdk.TracerProvider, error) {
	// Create the Jaeger exporter
	exp, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(ts.address)))
	if err != nil {
		return nil, err
	}

	tp := tracesdk.NewTracerProvider(
		// Always be sure to batch in production.
		tracesdk.WithBatcher(exp),
		// Record information about this application in an Resource.
		// TODO: Add resource from opentelemetry configuration
		tracesdk.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceNameKey.String("grafana"),
			attribute.String("environment", "production"),
		)),
		tracesdk.WithSampler(tracesdk.TraceIDRatioBased(ts.samplerParam)),
	)

	return tp, nil
}

func (ts *TracingService) initGlobalTracer() error {
	tp, err := ts.initJaegerCfg()
	if err != nil {
		return err
	}
	// Register our TracerProvider as the global so any imported
	// instrumentation in the future will default to using it
	// only if tracing is enabled
	if ts.enabled {
		otel.SetTracerProvider(tp)
	}

	Tracer = otel.GetTracerProvider().Tracer("component-main")

	if ts.zipkinPropagation {
		otel.SetTextMapPropagator(b3.New())
	}

	return nil
}

func (ts *TracingService) Run(ctx context.Context) error {
	<-ctx.Done()

	ts.log.Info("Closing tracing")
	ctxShutdown, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()
	if err := ts.tracerProvider.Shutdown(ctxShutdown); err != nil {
		return err
	}

	return nil
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

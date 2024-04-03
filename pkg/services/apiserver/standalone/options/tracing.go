package options

import (
	"context"
	"errors"
	"fmt"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/spf13/pflag"
	"go.opentelemetry.io/otel/attribute"
	genericfeatures "k8s.io/apiserver/pkg/features"
	genericapiserver "k8s.io/apiserver/pkg/server"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	k8stracing "k8s.io/component-base/tracing"
)

type TracingOptions struct {
	logger log.Logger

	JaegerAddress     string
	JaegerPropagation string

	OTLPAddress     string
	OTLPPropagation string

	Tags map[string]string

	SamplerType        string
	SamplerParam       float64
	SamplingServiceURL string

	TracingService *tracing.TracingService
}

func NewTracingOptions(logger log.Logger) *TracingOptions {
	return &TracingOptions{
		logger: logger,
		Tags:   map[string]string{},
	}
}

func (o *TracingOptions) AddFlags(fs *pflag.FlagSet) {
	fs.StringVar(&o.JaegerAddress, "grafana.tracing.jaeger.address", "", "Tracing Jaeger exporter destination, e.g. http://localhost:14268/api/traces. This enabled the Jaeger export and takes presedence over grafana.tracing.otlp.")
	fs.StringVar(&o.JaegerPropagation, "grafana.tracing.jaeger.propagation", "jaeger", "Tracing Jaeger propagation specifies the text map propagation format, w3c or jaeger.")
	fs.StringVar(&o.OTLPAddress, "grafana.tracing.otlp.address", "", "Tracing OTLP exporter destination, e.g. localhost:4317.")
	fs.StringVar(&o.OTLPPropagation, "grafana.tracing.otlp.propagation", "w3c", "Tracing OTLP propagation specifies the text map propagation format, w3c or jaeger.")
	fs.StringToStringVar(&o.Tags, "grafana.tracing.tag", map[string]string{}, "Tracing server tag in 'key=value' format. Specify multiple times to add many.")
	fs.StringVar(&o.SamplerType, "grafana.tracing.sampler-type", "const", "Tracing sampler type specifies the type of the sampler: const, probabilistic, rateLimiting, or remote.")
	fs.Float64Var(&o.SamplerParam, "grafana.tracing.sampler-param", 0, "Tracing sampler configuration parameter. For 'const' sampler, 0 or 1 for always false/true respectively. For 'rateLimiting' sampler, the number of spans per second. For 'remote' sampler, param is the same as for 'probabilistic' and indicates the initial sampling rate before the actual one is received from the sampling service.")
	fs.StringVar(&o.SamplingServiceURL, "grafana.tracing.sampling-service", "", "Tracing server sampling service URL (used for both Jaeger and OTLP) if grafana.tracing.sampler-type=remote.")
}

func (o *TracingOptions) Validate() []error {
	errors := []error{}

	if o.JaegerAddress != "" {
		if _, err := url.Parse(o.JaegerAddress); err != nil {
			errors = append(errors, fmt.Errorf("failed to parse tracing.jaeger.address: %w", err))
		}
	}

	if o.SamplingServiceURL != "" {
		if _, err := url.Parse(o.SamplingServiceURL); err != nil {
			errors = append(errors, fmt.Errorf("failed to parse tracing.sampling-service: %w", err))
		}
	}

	return errors
}

func (o *TracingOptions) ApplyTo(config *genericapiserver.RecommendedConfig) error {
	utilfeature.DefaultMutableFeatureGate.SetFromMap(map[string]bool{
		string(genericfeatures.APIServerTracing): false,
	})
	tracingCfg := tracing.NewEmptyTracingConfig()
	var err error

	if o.OTLPAddress != "" {
		tracingCfg, err = tracing.NewOTLPTracingConfig(o.OTLPAddress, o.OTLPPropagation)
	}

	if o.JaegerAddress != "" {
		tracingCfg, err = tracing.NewJaegerTracingConfig(o.JaegerAddress, o.JaegerPropagation)
	}

	if err != nil {
		return err
	}

	tracingCfg.ServiceName = "grafana-apiserver"
	tracingCfg.ServiceVersion = setting.BuildVersion

	for k, v := range o.Tags {
		tracingCfg.CustomAttribs = append(tracingCfg.CustomAttribs, attribute.String(k, v))
	}

	tracingCfg.Sampler = o.SamplerType
	tracingCfg.SamplerParam = o.SamplerParam
	tracingCfg.SamplerRemoteURL = o.SamplingServiceURL

	ts, err := tracing.ProvideService(tracingCfg)
	if err != nil {
		return err
	}

	o.TracingService = ts
	config.TracerProvider = ts.GetTracerProvider()

	if config.LoopbackClientConfig != nil {
		config.LoopbackClientConfig.Wrap(k8stracing.WrapperFor(config.TracerProvider))
	}

	config.AddPostStartHookOrDie("grafana-tracing-service", func(hookCtx genericapiserver.PostStartHookContext) error {
		ctx, cancel := context.WithCancel(context.Background())

		go func() {
			<-hookCtx.StopCh
			cancel()
		}()

		go func() {
			if err := ts.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
				o.logger.Error("failed to shutdown tracing service", "error", err)
			}
		}()

		return nil
	})

	return nil
}

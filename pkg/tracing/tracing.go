package tracing

import (
	"io"
	"io/ioutil"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"

	opentracing "github.com/opentracing/opentracing-go"
	jaeger "github.com/uber/jaeger-client-go"
	jaegercfg "github.com/uber/jaeger-client-go/config"
	jaegerlog "github.com/uber/jaeger-client-go/log"
	ini "gopkg.in/ini.v1"
)

var (
	logger log.Logger = log.New("tracing")
)

type TracingSettings struct {
	Enabled bool
	Address string
}

func Init(file *ini.File) (io.Closer, error) {
	settings := parseSettings(file)
	return internalInit(settings)
}

func parseSettings(file *ini.File) *TracingSettings {
	settings := &TracingSettings{}

	var section, err = setting.Cfg.GetSection("tracing.jaeger")
	if err != nil {
		return settings
	}

	settings.Address = section.Key("address").MustString("")
	if settings.Address != "" {
		settings.Enabled = true
	}

	return settings
}

func internalInit(settings *TracingSettings) (io.Closer, error) {
	if !settings.Enabled {
		return ioutil.NopCloser(nil), nil
	}

	cfg := jaegercfg.Configuration{
		Disabled: !settings.Enabled,
		Sampler: &jaegercfg.SamplerConfig{
			Type:  jaeger.SamplerTypeConst,
			Param: 1,
		},
		Reporter: &jaegercfg.ReporterConfig{
			LogSpans:           false,
			LocalAgentHostPort: settings.Address,
		},
	}

	jLogger := jaegerlog.StdLogger

	tracer, closer, err := cfg.New(
		"grafana",
		jaegercfg.Logger(jLogger),
	)
	if err != nil {
		return nil, err
	}

	logger.Info("Initialized jaeger tracer", "address", settings.Address)
	opentracing.InitGlobalTracer(tracer)
	return closer, nil
}

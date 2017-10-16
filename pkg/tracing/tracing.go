package tracing

import (
	"io"
	"strings"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"

	opentracing "github.com/opentracing/opentracing-go"
	jaegercfg "github.com/uber/jaeger-client-go/config"
	ini "gopkg.in/ini.v1"
)

var (
	logger log.Logger = log.New("tracing")
)

type TracingSettings struct {
	Enabled      bool
	Address      string
	CustomTags   map[string]string
	SamplerType  string
	SamplerParam float64
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

	settings.CustomTags = splitTagSettings(section.Key("always_included_tag").MustString(""))
	settings.SamplerType = section.Key("sampler_type").MustString("")
	settings.SamplerParam = section.Key("sampler_param").MustFloat64(1)

	return settings
}

func internalInit(settings *TracingSettings) (io.Closer, error) {
	if !settings.Enabled {
		return &nullCloser{}, nil
	}

	cfg := jaegercfg.Configuration{
		Disabled: !settings.Enabled,
		Sampler: &jaegercfg.SamplerConfig{
			Type:  settings.SamplerType,
			Param: settings.SamplerParam,
		},
		Reporter: &jaegercfg.ReporterConfig{
			LogSpans:           false,
			LocalAgentHostPort: settings.Address,
		},
	}

	jLogger := &jaegerLogWrapper{logger: log.New("jaeger")}

	options := []jaegercfg.Option{}
	options = append(options, jaegercfg.Logger(jLogger))

	for tag, value := range settings.CustomTags {
		options = append(options, jaegercfg.Tag(tag, value))
	}

	tracer, closer, err := cfg.New("grafana", options...)
	if err != nil {
		return nil, err
	}

	opentracing.InitGlobalTracer(tracer)
	logger.Info("Initializing Jaeger tracer", "address", settings.Address)
	return closer, nil
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

func (jlw *jaegerLogWrapper) Infof(msg string, args ...interface{}) {
	jlw.logger.Info(msg, args)
}

type nullCloser struct{}

func (*nullCloser) Close() error { return nil }

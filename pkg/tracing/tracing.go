package tracing

import (
	"io"
	"io/ioutil"
	"strings"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"

	opentracing "github.com/opentracing/opentracing-go"
	jaeger "github.com/uber/jaeger-client-go"
	jaegercfg "github.com/uber/jaeger-client-go/config"
	jaegerlog "github.com/uber/jaeger-client-go/log"
	ini "gopkg.in/ini.v1"
)

var (
	logger     log.Logger        = log.New("tracing")
	customTags map[string]string = map[string]string{}
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

	customTags = splitTagSettings(section.Key("always_included_tag").MustString(""))

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

	options := []jaegercfg.Option{}
	options = append(options, jaegercfg.Logger(jLogger))

	for tag, value := range customTags {
		options = append(options, jaegercfg.Tag(tag, value))
	}

	tracer, closer, err := cfg.New("grafana", options...)
	if err != nil {
		return nil, err
	}

	logger.Info("Initialized jaeger tracer", "address", settings.Address)
	opentracing.InitGlobalTracer(tracer)
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

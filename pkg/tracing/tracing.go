package tracing

import (
	"context"
	"io"
	"strings"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"

	opentracing "github.com/opentracing/opentracing-go"
	jaegercfg "github.com/uber/jaeger-client-go/config"
)

func init() {
	registry.RegisterService(&TracingService{})
}

type TracingService struct {
	enabled      bool
	address      string
	customTags   map[string]string
	samplerType  string
	samplerParam float64
	log          log.Logger
	closer       io.Closer

	Cfg *setting.Cfg `inject:""`
}

func (ts *TracingService) Init() error {
	ts.log = log.New("tracing")
	ts.parseSettings()

	if ts.enabled {
		ts.initGlobalTracer()
	}

	return nil
}

func (ts *TracingService) parseSettings() {
	var section, err = ts.Cfg.Raw.GetSection("tracing.jaeger")
	if err != nil {
		return
	}

	ts.address = section.Key("address").MustString("")
	if ts.address != "" {
		ts.enabled = true
	}

	ts.customTags = splitTagSettings(section.Key("always_included_tag").MustString(""))
	ts.samplerType = section.Key("sampler_type").MustString("")
	ts.samplerParam = section.Key("sampler_param").MustFloat64(1)
}

func (ts *TracingService) initGlobalTracer() error {
	cfg := jaegercfg.Configuration{
		Disabled: !ts.enabled,
		Sampler: &jaegercfg.SamplerConfig{
			Type:  ts.samplerType,
			Param: ts.samplerParam,
		},
		Reporter: &jaegercfg.ReporterConfig{
			LogSpans:           false,
			LocalAgentHostPort: ts.address,
		},
	}

	jLogger := &jaegerLogWrapper{logger: log.New("jaeger")}

	options := []jaegercfg.Option{}
	options = append(options, jaegercfg.Logger(jLogger))

	for tag, value := range ts.customTags {
		options = append(options, jaegercfg.Tag(tag, value))
	}

	tracer, closer, err := cfg.New("grafana", options...)
	if err != nil {
		return err
	}

	opentracing.InitGlobalTracer(tracer)

	ts.closer = closer

	return nil
}

func (ts *TracingService) Run(ctx context.Context) error {
	<-ctx.Done()

	if ts.closer != nil {
		ts.log.Info("Closing tracing")
		ts.closer.Close()
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

func (jlw *jaegerLogWrapper) Infof(msg string, args ...interface{}) {
	jlw.logger.Info(msg, args)
}

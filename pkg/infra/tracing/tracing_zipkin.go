package tracing

import (
	"fmt"
	"github.com/opentracing/opentracing-go"
	openZipkin "github.com/openzipkin-contrib/zipkin-go-opentracing"
	"github.com/openzipkin/zipkin-go"
	"github.com/openzipkin/zipkin-go/reporter/http"
	"math/rand"
	"strings"
)

func (ts *TracingService) parseSettingsZipkin() {
	var section, err = ts.Cfg.Raw.GetSection("tracing.zipkin")
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
	ts.disableSharedZipkinSpans = section.Key("disable_shared_zipkin_spans").MustBool(false)
	ts.tracing128bit = section.Key("tracing128bit").MustBool(false)
}

func (ts *TracingService) initGlobalTracerZipkin() error {
	opts, cfgErr := ts.initZipkinCfg()
	if cfgErr != nil {
		return cfgErr
	}

	reporter := http.NewReporter(ts.address)
	trace, tracerErr := zipkin.NewTracer(reporter, opts...)
	if tracerErr != nil {
		return tracerErr
	}
	opentracing.SetGlobalTracer(openZipkin.Wrap(trace))

	ts.closer = reporter
	return nil
}

func (ts *TracingService) initZipkinCfg() ([]zipkin.TracerOption, error) {
	serviceName := ts.Cfg.Raw.Section("").Key("instance_name").MustString("grafana")
	httpAddr := ts.Cfg.Raw.Section("server").Key("http_addr").MustString("0.0.0.0")
	httpPort := ts.Cfg.Raw.Section("server").Key("http_port").MustString("3000")

	endpoint, err := zipkin.NewEndpoint(serviceName, httpAddr+":"+httpPort)
	if err != nil {
		return nil, err
	}

	opts := []zipkin.TracerOption{
		zipkin.WithLocalEndpoint(endpoint),
		zipkin.WithTags(ts.customTags),
	}

	if strings.EqualFold(ts.samplerType, "const") && ts.samplerParam == 0 {
		ts.samplerType = "never"
	} else if strings.EqualFold(ts.samplerType, "const") && ts.samplerParam == 1 {
		ts.samplerType = "always"
	} else if strings.EqualFold(ts.samplerType, "probabilistic") {
		ts.samplerType = "counting"
	} else if strings.EqualFold(ts.samplerType, "rateLimiting") {
		ts.samplerType = "boundary"
	}

	switch strings.ToLower(ts.samplerType) {
	case "always", "":
		opts = append(opts, zipkin.WithSampler(zipkin.AlwaysSample))
	case "never":
		opts = append(opts, zipkin.WithSampler(zipkin.NeverSample))
	case "modulo":
		opts = append(opts, zipkin.WithSampler(zipkin.NewModuloSampler(uint64(ts.samplerParam))))
	case "counting":
		counting, err := zipkin.NewCountingSampler(ts.samplerParam)
		if err != nil {
			return nil, err
		}
		opts = append(opts, zipkin.WithSampler(counting))
	case "boundary":
		smpParm := int64(ts.samplerParam)
		boundary, err := zipkin.NewBoundarySampler(ts.samplerParam, rand.Int63n(smpParm))
		if err != nil {
			return nil, err
		}
		opts = append(opts, zipkin.WithSampler(boundary))
	default:
		return nil, fmt.Errorf("unkown sampleType %s", ts.samplerType)
	}
	opts = append(opts, zipkin.WithTraceID128Bit(ts.tracing128bit))

	return opts, nil
}

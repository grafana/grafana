package setting

import (
	"fmt"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"go.opentelemetry.io/otel/attribute"
)

const (
	envJaegerAgentHost = "JAEGER_AGENT_HOST"
	envJaegerAgentPort = "JAEGER_AGENT_PORT"
)

func ProvideTracingConfig(cfg *Cfg) (*tracing.TracingConfig, error) {
	return ParseTracingConfig(cfg)
}

func ParseTracingConfig(cfg *Cfg) (*tracing.TracingConfig, error) {
	if cfg == nil {
		return nil, fmt.Errorf("cfg cannot be nil")
	}
	tc := tracing.NewEmptyTracingConfig()
	tc.ServiceName = "grafana"
	tc.ServiceVersion = cfg.BuildVersion

	legacyAddress, legacyTags := "", ""
	if section, err := cfg.Raw.GetSection("tracing.jaeger"); err == nil {
		legacyAddress = section.Key("address").MustString("")
		if legacyAddress == "" {
			host, port := os.Getenv(envJaegerAgentHost), os.Getenv(envJaegerAgentPort)
			if host != "" || port != "" {
				legacyAddress = fmt.Sprintf("%s:%s", host, port)
			}
		}
		legacyTags = section.Key("always_included_tag").MustString("")
		tc.Sampler = section.Key("sampler_type").MustString("")
		tc.SamplerParam = section.Key("sampler_param").MustFloat64(1)
		tc.SamplerRemoteURL = section.Key("sampling_server_url").MustString("")
	}
	section := cfg.Raw.Section("tracing.opentelemetry")
	var err error
	// we default to legacy tag set (attributes) if the new config format is absent
	tc.CustomAttribs, err = splitCustomAttribs(section.Key("custom_attributes").MustString(legacyTags))
	if err != nil {
		return nil, err
	}

	// if sampler_type is set in tracing.opentelemetry, we ignore the config in tracing.jaeger
	sampler := section.Key("sampler_type").MustString("")
	if sampler != "" {
		tc.Sampler = sampler
	}

	samplerParam := section.Key("sampler_param").MustFloat64(0)
	if samplerParam != 0 {
		tc.SamplerParam = samplerParam
	}

	samplerRemoteURL := section.Key("sampling_server_url").MustString("")
	if samplerRemoteURL != "" {
		tc.SamplerRemoteURL = samplerRemoteURL
	}

	section = cfg.Raw.Section("tracing.opentelemetry.jaeger")
	tc.Enabled = tracing.NoopExporter

	// we default to legacy Jaeger agent address if the new config value is empty
	tc.Address = section.Key("address").MustString(legacyAddress)
	tc.Propagation = section.Key("propagation").MustString("")
	if tc.Address != "" {
		tc.Enabled = tracing.JaegerExporter
		return tc, nil
	}

	section = cfg.Raw.Section("tracing.opentelemetry.otlp")
	tc.Address = section.Key("address").MustString("")
	if tc.Address != "" {
		tc.Enabled = tracing.OTLPExporter
	}
	tc.Propagation = section.Key("propagation").MustString("")
	return tc, nil
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

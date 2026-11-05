package tracingsetting

import (
	"context"
	"fmt"
	"os"
	"strings"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	envJaegerAgentHost = "JAEGER_AGENT_HOST"
	envJaegerAgentPort = "JAEGER_AGENT_PORT"
)

func ProvideTracingConfig(cfgProvider configprovider.ConfigProvider) (*tracing.TracingConfig, error) {
	cfg, err := cfgProvider.Get(context.Background())
	if err != nil {
		return nil, err
	}
	return ParseTracingConfig(cfg)
}

func ParseTracingConfig(cfg *setting.Cfg) (*tracing.TracingConfig, error) {
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

	// Allow overriding service name via configuration
	serviceName := section.Key("service_name").MustString("")
	if serviceName != "" {
		tc.ServiceName = serviceName
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

	tc.FilterOperationalEndpoints = section.Key("filter_operational_endpoints").MustBool(false)

	section = cfg.Raw.Section("tracing.opentelemetry.jaeger")
	tc.Exporter = tracing.NoopExporter

	// we default to legacy Jaeger agent address if the new config value is empty
	tc.Address = section.Key("address").MustString(legacyAddress)
	tc.Propagation = section.Key("propagation").MustString("")
	if tc.Address != "" {
		tc.Exporter = tracing.JaegerExporter
		return tc, nil
	}

	section = cfg.Raw.Section("tracing.opentelemetry.otlp")
	tc.Address = section.Key("address").MustString("")
	if tc.Address != "" {
		tc.Exporter = tracing.OTLPExporter
	}
	tc.Propagation = section.Key("propagation").MustString("")
	tc.Insecure = section.Key("insecure").MustBool(true)
	if tc.Exporter == tracing.OTLPExporter {
		return tc, nil
	}

	// File exporter (only when no collector endpoint is configured): capture
	// spans to a local OTLP/JSON file for offline analysis without a backend.
	section = cfg.Raw.Section("tracing.opentelemetry.file")
	if path := section.Key("path").MustString(""); path != "" {
		tc.Exporter = tracing.FileExporter
		tc.FilePath = path
		tc.FileMaxSize = section.Key("max_file_size_bytes").MustInt64(tracing.DefaultTraceFileMaxSize)
		tc.FileCaptureDuration = section.Key("capture_duration").MustDuration(tracing.DefaultTraceCaptureDuration)
		// Capturing is an explicit, on-demand action; sample everything unless
		// the operator narrowed it, otherwise the file may come out empty.
		if tc.Sampler == "" {
			tc.Sampler = "const"
			tc.SamplerParam = 1
		}
	}
	return tc, nil
}

func splitCustomAttribs(s string) ([]attribute.KeyValue, error) {
	res := []attribute.KeyValue{}

	attribs := strings.SplitSeq(s, ",")
	for v := range attribs {
		parts := strings.SplitN(v, ":", 2)
		if len(parts) > 1 {
			res = append(res, attribute.String(parts[0], parts[1]))
		} else if v != "" {
			return nil, fmt.Errorf("custom attribute malformed - must be in 'key:value' form: %q", v)
		}
	}

	return res, nil
}

package router

import (
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/dskit/middleware"
	grpc_retry "github.com/grpc-ecosystem/go-grpc-middleware/retry"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/grafana/grafana/pkg/setting"
)

// backendGRPCSection configures the router's gRPC connections to the plugin
// deployments listed by plugins_url and core_url.
const backendGRPCSection = "router.backend_grpc"

// pluginGRPCConfig configures the router's gRPC connections to plugin
// deployments, from the [router.backend_grpc] section.
type pluginGRPCConfig struct {
	Retry pluginGRPCRetryConfig
}

// pluginGRPCRetryConfig configures retries of unary plugin calls that fail
// with one of pluginGRPCRetryCodes.
type pluginGRPCRetryConfig struct {
	// Max counts every attempt, including the first, so 0 and 1 both disable
	// retries.
	Max     uint
	Backoff time.Duration
	Jitter  float64
}

func defaultPluginGRPCConfig() pluginGRPCConfig {
	return pluginGRPCConfig{
		Retry: pluginGRPCRetryConfig{
			Max:     3,
			Backoff: time.Second,
			Jitter:  0.1,
		},
	}
}

// parsePluginGRPCConfig reads the [router.backend_grpc] section, using the
// defaults for keys that are unset.
func parsePluginGRPCConfig(cfg *setting.Cfg) (pluginGRPCConfig, error) {
	section := cfg.SectionWithEnvOverrides(backendGRPCSection)
	c, err := parsePluginGRPCSection(section)
	if err != nil {
		return c, fmt.Errorf("%s: %w", backendGRPCSection, err)
	}
	return c, nil
}

func parsePluginGRPCSection(section *setting.DynamicSection) (pluginGRPCConfig, error) {
	cfg := defaultPluginGRPCConfig()
	var err error
	if cfg.Retry.Max, err = parseUintKey(section, "retry_max", cfg.Retry.Max); err != nil {
		return cfg, err
	}
	if cfg.Retry.Backoff, err = parseDurationKey(section, "retry_backoff", cfg.Retry.Backoff); err != nil {
		return cfg, err
	}
	if cfg.Retry.Jitter, err = parseFractionKey(section, "retry_jitter", cfg.Retry.Jitter); err != nil {
		return cfg, err
	}
	return cfg, nil
}

// dialOptions returns the options for a connection to a plugin deployment.
// requestDuration must already be curried with the plugin ID.
func (c pluginGRPCConfig) dialOptions(requestDuration *prometheus.HistogramVec) []grpc.DialOption {
	return []grpc.DialOption{
		// Plugin deployments expose plaintext gRPC on the internal cluster network.
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
		// Instrumentation wraps the retries, so each call is recorded once,
		// with the outcome of its last attempt.
		grpc.WithChainUnaryInterceptor(
			middleware.UnaryClientInstrumentInterceptor(requestDuration, middleware.ReportGRPCStatusOption),
			c.Retry.unaryInterceptor(),
		),
		grpc.WithChainStreamInterceptor(middleware.StreamClientInstrumentInterceptor(requestDuration, middleware.ReportGRPCStatusOption)),
		// Spread calls over every address the host resolves to, rather than
		// pinning the first one.
		grpc.WithDefaultServiceConfig(`{"loadBalancingPolicy":"round_robin"}`),
		// Don't look up service config in DNS TXT records; the default above
		// still applies.
		grpc.WithDisableServiceConfig(),
	}
}

// pluginGRPCRetryCodes are the codes a plugin call is retried on. Unlike the
// unified storage client, ResourceExhausted is excluded: the client also
// reports it for a response over its receive limit, so a retry would re-run
// the plugin request only to fail the same way.
var pluginGRPCRetryCodes = []codes.Code{codes.Unavailable}

func (c pluginGRPCRetryConfig) unaryInterceptor() grpc.UnaryClientInterceptor {
	return grpc_retry.UnaryClientInterceptor(
		grpc_retry.WithMax(c.Max),
		grpc_retry.WithBackoff(grpc_retry.BackoffExponentialWithJitter(c.Backoff, c.Jitter)),
		grpc_retry.WithCodes(pluginGRPCRetryCodes...),
	)
}

func parseUintKey(section *setting.DynamicSection, key string, def uint) (uint, error) {
	value := section.Key(key).String()
	if value == "" {
		return def, nil
	}
	n, err := strconv.ParseUint(value, 10, 0)
	if err != nil {
		return 0, fmt.Errorf("%s must be a non-negative integer, got %q", key, value)
	}
	return uint(n), nil
}

func parseDurationKey(section *setting.DynamicSection, key string, def time.Duration) (time.Duration, error) {
	value := section.Key(key).String()
	if value == "" {
		return def, nil
	}
	d, err := time.ParseDuration(value)
	if err != nil || d < 0 {
		return 0, fmt.Errorf("%s must be a non-negative duration, got %q", key, value)
	}
	return d, nil
}

func parseFractionKey(section *setting.DynamicSection, key string, def float64) (float64, error) {
	value := section.Key(key).String()
	if value == "" {
		return def, nil
	}
	f, err := strconv.ParseFloat(value, 64)
	if err != nil || f < 0 || f > 1 {
		return 0, fmt.Errorf("%s must be a number from 0 to 1, got %q", key, value)
	}
	return f, nil
}

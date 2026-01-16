package sql

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	//_ UnifiedGrpcService = (*service)(nil)
	_ UnifiedGrpcService = (*searchService)(nil)
	_ UnifiedGrpcService = (*storageService)(nil)
)

type UnifiedGrpcService interface {
	services.NamedService

	// Return the address where this service is running
	GetAddress() string
}

type authenticatorWithFallback struct {
	authenticator func(ctx context.Context) (context.Context, error)
	fallback      func(ctx context.Context) (context.Context, error)
	metrics       *metrics
	tracer        trace.Tracer
}

type metrics struct {
	requestsTotal *prometheus.CounterVec
}

func (f *authenticatorWithFallback) Authenticate(ctx context.Context) (context.Context, error) {
	ctx, span := f.tracer.Start(ctx, "grpcutils.AuthenticatorWithFallback.Authenticate")
	defer span.End()

	// Try to authenticate with the new authenticator first
	span.SetAttributes(attribute.Bool("fallback_used", false))
	newCtx, err := f.authenticator(ctx)
	if err == nil {
		// fallback not used, authentication successful
		f.metrics.requestsTotal.WithLabelValues("false", "true").Inc()
		return newCtx, nil
	}

	// In case of error, fallback to the legacy authenticator
	span.SetAttributes(attribute.Bool("fallback_used", true))
	newCtx, err = f.fallback(ctx)
	if newCtx != nil {
		newCtx = resource.WithFallback(newCtx)
	}
	f.metrics.requestsTotal.WithLabelValues("true", fmt.Sprintf("%t", err == nil)).Inc()
	return newCtx, err
}

func newMetrics(reg prometheus.Registerer) *metrics {
	return &metrics{
		requestsTotal: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_grpc_authenticator_with_fallback_requests_total",
				Help: "Number requests using the authenticator with fallback",
			}, []string{"fallback_used", "result"}),
	}
}

func ReadGrpcServerConfig(cfg *setting.Cfg) *grpcutils.AuthenticatorConfig {
	section := cfg.SectionWithEnvOverrides("grpc_server_authentication")

	return &grpcutils.AuthenticatorConfig{
		SigningKeysURL:   section.Key("signing_keys_url").MustString(""),
		AllowedAudiences: section.Key("allowed_audiences").Strings(","),
		AllowInsecure:    cfg.Env == setting.Dev,
	}
}

func NewAuthenticatorWithFallback(cfg *setting.Cfg, reg prometheus.Registerer, tracer trace.Tracer, fallback func(context.Context) (context.Context, error)) func(context.Context) (context.Context, error) {
	authCfg := ReadGrpcServerConfig(cfg)
	authenticator := grpcutils.NewAuthenticator(authCfg, tracer)
	metrics := newMetrics(reg)
	return func(ctx context.Context) (context.Context, error) {
		a := &authenticatorWithFallback{
			authenticator: authenticator,
			fallback:      fallback,
			tracer:        tracer,
			metrics:       metrics,
		}
		return a.Authenticate(ctx)
	}
}

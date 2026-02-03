package server

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func (ms *ModuleServer) initGRPCServer(authenticatorEnabled bool) (services.Service, error) {
	tracer := otel.Tracer("grpc-server")
	var authn interceptors.Authenticator
	if authenticatorEnabled {
		// FIXME: This is a temporary solution while we are migrating to the new authn interceptor
		// grpcutils.NewGrpcAuthenticator should be used instead.
		authn = interceptors.AuthenticatorFunc(newAuthenticatorWithFallback(ms.cfg, ms.registerer, tracer, func(ctx context.Context) (context.Context, error) {
			auth := grpc.Authenticator{Tracer: tracer}
			return auth.Authenticate(ctx)
		}))
	}

	handler, err := grpcserver.ProvideService(ms.cfg, ms.features, authn, tracer, ms.registerer)
	if err != nil {
		return nil, err
	}

	grpcService := grpcserver.ProvideDSKitService(handler, modules.GRPCServer)
	ms.grpcServer = grpcService.GetServer()
	return grpcService, nil
}

type authenticatorWithFallback struct {
	authenticator func(ctx context.Context) (context.Context, error)
	fallback      func(ctx context.Context) (context.Context, error)
	metrics       *grpcMetrics
	tracer        trace.Tracer
}

type grpcMetrics struct {
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

func newGRPCMetrics(reg prometheus.Registerer) *grpcMetrics {
	return &grpcMetrics{
		requestsTotal: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_grpc_authenticator_with_fallback_requests_total",
				Help: "Number requests using the authenticator with fallback",
			}, []string{"fallback_used", "result"}),
	}
}

func readGrpcServerConfig(cfg *setting.Cfg) *grpcutils.AuthenticatorConfig {
	section := cfg.SectionWithEnvOverrides("grpc_server_authentication")

	return &grpcutils.AuthenticatorConfig{
		SigningKeysURL:   section.Key("signing_keys_url").MustString(""),
		AllowedAudiences: section.Key("allowed_audiences").Strings(","),
		AllowInsecure:    cfg.Env == setting.Dev,
	}
}

func newAuthenticatorWithFallback(cfg *setting.Cfg, reg prometheus.Registerer, tracer trace.Tracer, fallback func(context.Context) (context.Context, error)) func(context.Context) (context.Context, error) {
	authCfg := readGrpcServerConfig(cfg)
	authenticator := grpcutils.NewAuthenticator(authCfg, tracer)
	metrics := newGRPCMetrics(reg)
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

package sql

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/grpcutils"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
)

// authenticatorWithFallback wraps two authenticators, trying the primary first
// and falling back to the secondary if the primary fails.
type authenticatorWithFallback struct {
	authenticator func(ctx context.Context) (context.Context, error)
	fallback      func(ctx context.Context) (context.Context, error)
	metrics       *authMetrics
	tracer        trace.Tracer
}

// authMetrics tracks authentication metrics for the fallback authenticator.
type authMetrics struct {
	requestsTotal *prometheus.CounterVec
}

// CreateAuthenticator creates the standard authenticator used by all unified storage services.
// It combines the grpcutils authenticator with a fallback to the legacy gRPC authenticator.
func CreateAuthenticator(cfg *setting.Cfg, reg prometheus.Registerer, tracer trace.Tracer) func(ctx context.Context) (context.Context, error) {
	return NewAuthenticatorWithFallback(cfg, reg, tracer, func(ctx context.Context) (context.Context, error) {
		auth := grpc.Authenticator{Tracer: tracer}
		return auth.Authenticate(ctx)
	})
}

// NewAuthenticatorWithFallback creates a new authenticator that tries the grpcutils authenticator
// first and falls back to the provided fallback authenticator if the primary fails.
// FIXME: This is a temporary solution while we are migrating to the new authn interceptor
// grpcutils.NewGrpcAuthenticator should be used instead.
func NewAuthenticatorWithFallback(cfg *setting.Cfg, reg prometheus.Registerer, tracer trace.Tracer, fallback func(context.Context) (context.Context, error)) func(context.Context) (context.Context, error) {
	section := cfg.SectionWithEnvOverrides("grpc_server_authentication")

	authCfg := &grpcutils.AuthenticatorConfig{
		SigningKeysURL:   section.Key("signing_keys_url").MustString(""),
		AllowedAudiences: section.Key("allowed_audiences").Strings(","),
		AllowInsecure:    cfg.Env == setting.Dev,
	}
	authenticator := grpcutils.NewAuthenticator(authCfg, tracer)
	metrics := &authMetrics{
		requestsTotal: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_grpc_authenticator_with_fallback_requests_total",
				Help: "Number requests using the authenticator with fallback",
			}, []string{"fallback_used", "result"}),
	}
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

// Authenticate tries the primary authenticator first, falling back to the secondary
// if the primary fails. It tracks metrics for both paths.
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

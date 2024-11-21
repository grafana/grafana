package grpcutils

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"sync"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
)

var once sync.Once

func NewInProcGrpcAuthenticator() *authnlib.GrpcAuthenticator {
	// In proc grpc ID token signature verification can be skipped
	return authnlib.NewUnsafeGrpcAuthenticator(
		&authnlib.GrpcAuthenticatorConfig{},
		authnlib.WithDisableAccessTokenAuthOption(),
		authnlib.WithIDTokenAuthOption(true),
	)
}

func NewGrpcAuthenticator(cfg *setting.Cfg, tracer tracing.Tracer) (*authnlib.GrpcAuthenticator, error) {
	authCfg, err := ReadGrpcServerConfig(cfg)
	if err != nil {
		return nil, err
	}
	grpcAuthCfg := authnlib.GrpcAuthenticatorConfig{
		KeyRetrieverConfig: authnlib.KeyRetrieverConfig{
			SigningKeysURL: authCfg.SigningKeysURL,
		},
		VerifierConfig: authnlib.VerifierConfig{
			AllowedAudiences: authCfg.AllowedAudiences,
		},
	}

	client := http.DefaultClient
	if cfg.Env == setting.Dev {
		// allow insecure connections in development mode to facilitate testing
		client = &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}
	}
	keyRetriever := authnlib.NewKeyRetriever(grpcAuthCfg.KeyRetrieverConfig, authnlib.WithHTTPClientKeyRetrieverOpt(client))

	grpcOpts := []authnlib.GrpcAuthenticatorOption{
		authnlib.WithIDTokenAuthOption(true),
		authnlib.WithKeyRetrieverOption(keyRetriever),
		authnlib.WithTracerAuthOption(tracer),
	}
	if authCfg.Mode == ModeOnPrem {
		grpcOpts = append(grpcOpts,
			// Access token are not yet available on-prem
			authnlib.WithDisableAccessTokenAuthOption(),
		)
	}

	return authnlib.NewGrpcAuthenticator(
		&grpcAuthCfg,
		grpcOpts...,
	)
}

type contextFallbackKey struct{}

type AuthenticatorWithFallback struct {
	authenticator *authnlib.GrpcAuthenticator
	fallback      interceptors.Authenticator
	metrics       *metrics
	tracer        tracing.Tracer
}

func NewGrpcAuthenticatorWithFallback(cfg *setting.Cfg, reg prometheus.Registerer, tracer tracing.Tracer, fallback interceptors.Authenticator) (interceptors.Authenticator, error) {
	authCfg, err := ReadGrpcServerConfig(cfg)
	if err != nil {
		return nil, err
	}

	authenticator, err := NewGrpcAuthenticator(cfg, tracer)
	if err != nil {
		return nil, err
	}

	if !authCfg.LegacyFallback {
		return authenticator, nil
	}

	return &AuthenticatorWithFallback{
		authenticator: authenticator,
		fallback:      fallback,
		metrics:       newMetrics(reg),
		tracer:        tracer,
	}, nil
}

func FallbackUsed(ctx context.Context) bool {
	return ctx.Value(contextFallbackKey{}) != nil
}

func (f *AuthenticatorWithFallback) Authenticate(ctx context.Context) (context.Context, error) {
	ctx, span := f.tracer.Start(ctx, "grpcutils.AuthenticatorWithFallback.Authenticate")
	defer span.End()
	span.SetAttributes(attribute.Bool("fallback_used", false))
	// Try to authenticate with the new authenticator first
	newCtx, err := f.authenticator.Authenticate(ctx)
	if err != nil {
		// In case of error, fallback to the legacy authenticator
		newCtx, err = f.fallback.Authenticate(ctx)
		f.metrics.fallbackCounter.WithLabelValues(fmt.Sprintf("%t", err == nil)).Inc()
		span.SetAttributes(attribute.Bool("fallback_used", true))
		newCtx = context.WithValue(newCtx, contextFallbackKey{}, true)
	}
	return newCtx, err
}

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "grpc_authenticator"
)

type metrics struct {
	fallbackCounter *prometheus.CounterVec
}

func newMetrics(reg prometheus.Registerer) *metrics {
	m := &metrics{
		fallbackCounter: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "fallback_total",
				Help:      "Number of times the fallback authenticator was used",
			}, []string{"result"}),
	}

	if reg != nil {
		once.Do(func() {
			reg.MustRegister(m.fallbackCounter)
		})
	}

	return m
}
